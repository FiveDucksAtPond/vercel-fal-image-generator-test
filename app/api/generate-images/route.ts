import { NextRequest, NextResponse } from "next/server";
import { experimental_generateImage as generateImage } from "ai";
import { createReplicate } from "@ai-sdk/replicate";
import { ProviderKey } from "@/lib/provider-config";
import supabase from "@/lib/supabase-admin";
import { GenerateImageRequest } from "@/lib/api-types";

export const runtime = "nodejs";

/**
 * Intended to be slightly less than the maximum execution time allowed by the
 * runtime so that we can gracefully terminate our request.
 */
const TIMEOUT_MILLIS = 55 * 1000;

const DEFAULT_IMAGE_SIZE = "1024x1024";
const DEFAULT_ASPECT_RATIO = "1:1";

interface ProviderConfig {
  createImageModel: (modelId: string) => unknown;
  dimensionFormat: "size" | "aspectRatio";
}

const replicate = createReplicate({
  apiToken: process.env.REPLICATE_API_TOKEN,
});

const providerConfig: Record<ProviderKey, ProviderConfig> = {
  replicate: {
    createImageModel: replicate.image,
    dimensionFormat: "size",
  },
};

const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMillis: number,
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), timeoutMillis),
    ),
  ]);
};


export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const { prompt, provider, modelId, user_email, user_uuid } =
    (await req.json()) as GenerateImageRequest;

  try {
    if (!prompt || !provider || !modelId || !providerConfig[provider]) {
      const error = "Invalid request parameters";
      console.error(`${error} [requestId=${requestId}]`);
      return NextResponse.json({ error }, { status: 400 });
    }
    // Enforce login on server too
    if (!user_email || !user_uuid) {
      const error = "Authentication required";
      console.error(`${error} [requestId=${requestId}]`);
      return NextResponse.json({ error }, { status: 401 });
    }
    console.log(provider, modelId);

    const config = providerConfig[provider];
    const startstamp = performance.now();
    const generatePromise = generateImage({
      model: config.createImageModel(modelId) as never,
      prompt,
      ...(config.dimensionFormat === "size"
        ? { size: DEFAULT_IMAGE_SIZE }
        : { aspectRatio: DEFAULT_ASPECT_RATIO }),
    });

    const { image, warnings } = await withTimeout(generatePromise, TIMEOUT_MILLIS);
    if (warnings?.length > 0) {
      console.warn(
        `Warnings [requestId=${requestId}, provider=${provider}, model=${modelId}]: `,
        warnings,
      );
    }

    // Attempt to persist the image to Supabase Storage and DB (always try to store)
    let publicUrl: string | null = null;
    let finalImageUrl: string | null = null;
    try {
      if (!supabase) {
        console.warn("Supabase env not configured; skipping save.");
        // Fall back to returning remote URL if present
        finalImageUrl = (image as any)?.url ?? null;
      } else {
        const sb: any = supabase as any;
        const bucket = process.env.SUPABASE_BUCKET || "images";
        // Ensure bucket exists (ignore error if it already exists)
        try { await sb.storage.createBucket(bucket, { public: true }); } catch {}
        const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random()
          .toString(36)
          .slice(2, 8)}.png`;
        const path = `${filename}`;
        // Build a buffer either from base64 or by downloading the remote URL
        let buffer: Buffer | null = null;
        if ((image as any)?.base64) {
          buffer = Buffer.from((image as any).base64, "base64");
        } else if ((image as any)?.url) {
          try {
            const resp = await fetch((image as any).url);
            if (resp.ok) {
              const arr = await resp.arrayBuffer();
              buffer = Buffer.from(arr);
            } else {
              console.warn("Failed to fetch image URL for upload:", resp.status, await resp.text());
            }
          } catch (e) {
            console.warn("Error fetching image URL for upload:", e);
          }
        }
        if (buffer) {
          const { error: uploadError } = await sb.storage.from(bucket).upload(path, buffer, {
            contentType: "image/png",
            upsert: false,
          });
          if (uploadError) {
            console.warn("Supabase upload failed, will fall back to remote URL:", uploadError);
          } else {
            const { data: urlData } = sb.storage.from(bucket).getPublicUrl(path);
            publicUrl = urlData?.publicUrl || null;
            finalImageUrl = publicUrl || null;
          }
        }
        // If we couldn't upload, fall back to provider URL if present
        if (!finalImageUrl) {
          finalImageUrl = (image as any)?.url ?? null;
        }

        // Insert DB row with prompt, image_url, created_at, and UUID/email for attribution
        if (finalImageUrl) {
          const created_at = new Date().toISOString();
          const baseRow: any = { prompt, image_url: finalImageUrl, created_at };

          const tryInsert = async (row: any) => {
            const { error } = await sb.from("user_generated_images").insert(row);
            return error;
          };

          let insertError: any = null;
          if (user_email && user_uuid) {
            // Try common schema variants in order of likelihood
            // 1) user_email + uuid (lowercase)
            insertError = await tryInsert({ ...baseRow, user_email, uuid: user_uuid });
            // 2) email + uuid (lowercase)
            if (insertError) {
              console.warn("user_generated_images insert(user_email,uuid) failed; trying email+uuid:", insertError?.message || insertError);
              insertError = await tryInsert({ ...baseRow, email: user_email, uuid: user_uuid });
            }
            // 3) user_email + user_uuid (legacy)
            if (insertError) {
              console.warn("user_generated_images insert(email,uuid) failed; trying user_uuid column:", insertError?.message || insertError);
              insertError = await tryInsert({ ...baseRow, user_email, user_uuid });
            }
            // 4) email + user_uuid (legacy)
            if (insertError) {
              console.warn("user_generated_images insert(user_email,user_uuid) failed; trying email+user_uuid:", insertError?.message || insertError);
              insertError = await tryInsert({ ...baseRow, email: user_email, user_uuid });
            }
            // 5) user_email + UUID (uppercase)
            if (insertError) {
              console.warn("user_generated_images insert(email,user_uuid) failed; trying UUID column:", insertError?.message || insertError);
              insertError = await tryInsert({ ...baseRow, user_email, UUID: user_uuid });
            }
            // 6) email + UUID (uppercase)
            if (insertError) {
              console.warn("user_generated_images insert(user_email,UUID) failed; trying email+UUID:", insertError?.message || insertError);
              insertError = await tryInsert({ ...baseRow, email: user_email, UUID: user_uuid });
            }
          } else {
            insertError = await tryInsert(baseRow);
          }
          // 5) As a last resort, save base row without user fields
          if (insertError) {
            console.warn("user_generated_images insert with UUID/email failed; saving base row only:", insertError?.message || insertError);
            insertError = await tryInsert(baseRow);
          }
          if (insertError) {
            console.warn("Supabase insert into user_generated_images failed:", insertError);
          } else {
            // Ensure uuid column is populated even if initial insert schema didn't match
            try {
              // Try lowercase 'uuid'
              const { error: upd1 } = await sb
                .from("user_generated_images")
                .update({ uuid: user_uuid })
                .eq("image_url", finalImageUrl)
                .is("uuid", null);
              // Try uppercase 'UUID' if needed
              if (upd1) {
                const { error: upd2 } = await sb
                  .from("user_generated_images")
                  .update({ UUID: user_uuid })
                  .eq("image_url", finalImageUrl)
                  .is("UUID", null as any);
                if (upd2) {
                  console.warn("Post-insert UUID update failed:", upd1, upd2);
                }
              }
            } catch (e) {
              console.warn("Post-insert UUID ensure step failed:", e);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Supabase save failed:", e);
    }

    console.log(
      `Completed image request [requestId=${requestId}, provider=${provider}, model=${modelId}, elapsed=${(
        (performance.now() - startstamp) /
        1000
      ).toFixed(1)}s].`,
    );

    const result = {
      provider,
      image: image.base64,
      image_url: finalImageUrl,
    } as const;
    return NextResponse.json(result, {
      status: "image" in result ? 200 : 500,
    });
  } catch (error) {
    // Log full error detail on the server, but return a generic error message
    // to avoid leaking any sensitive information to the client.
    console.error(
      `Error generating image [requestId=${requestId}, provider=${provider}, model=${modelId}]: `,
      error,
    );
    return NextResponse.json(
      {
        error: "Failed to generate image. Please try again later.",
      },
      { status: 500 },
    );
  }
}
