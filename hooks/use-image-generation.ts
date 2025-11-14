import { useState } from "react";
import { ImageError, ImageResult, ProviderTiming } from "@/lib/image-types";
import { initializeProviderRecord, ProviderKey } from "@/lib/provider-config";

// Add instanceId to uniquely identify provider instances
interface ProviderInstance {
  provider: ProviderKey;
  instanceId: string;
  model: string;
}

interface UseImageGenerationReturn {
  images: ImageResult[];
  errors: ImageError[];
  timings: Record<string, ProviderTiming>; // Changed to string keys to support instance IDs
  failedProviders: string[]; // Changed to string to support instance IDs
  isLoading: boolean;
  startGeneration: (
    prompt: string,
    providerInstances: ProviderInstance[]
  ) => Promise<void>;
  resetState: () => void;
  activePrompt: string;
}

export function useImageGeneration(): UseImageGenerationReturn {
  const [images, setImages] = useState<ImageResult[]>([]);
  const [errors, setErrors] = useState<ImageError[]>([]);
  const [timings, setTimings] = useState<Record<string, ProviderTiming>>({});
  const [failedProviders, setFailedProviders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activePrompt, setActivePrompt] = useState("");

  const resetState = () => {
    setImages([]);
    setErrors([]);
    setTimings({});
    setFailedProviders([]);
    setIsLoading(false);
  };

  const startGeneration = async (
    prompt: string,
    providerInstances: ProviderInstance[]
  ) => {
    // Require login: must have userProfile in localStorage
    let profile: { email?: string; user_uuid?: string } | null = null;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("userProfile");
        if (raw) profile = JSON.parse(raw);
      } catch {}
    }
    if (!profile?.email || !profile?.user_uuid) {
      setErrors([{ provider: providerInstances[0]?.provider ?? "replicate", message: "Please log in to generate images." }]);
      setIsLoading(false);
      return;
    }
    setActivePrompt(prompt);
    try {
      setIsLoading(true);
      // Initialize images array with null values
      setImages(
        providerInstances.map((instance) => ({
          provider: instance.provider,
          image: null,
          modelId: instance.model,
          instanceId: instance.instanceId,
        })),
      );

      // Clear previous state
      setErrors([]);
      setFailedProviders([]);

      // Initialize timings with start times
      const now = Date.now();
      setTimings(
        Object.fromEntries(
          providerInstances.map((instance) => [
            instance.instanceId, 
            { startTime: now }
          ]),
        )
      );

      // Helper to fetch a single provider
      const generateImage = async (instance: ProviderInstance) => {
        const { provider, model, instanceId } = instance;
        const startTime = now;
        console.log(
          `Generate image request [provider=${provider}, instanceId=${instanceId}, modelId=${model}]`,
        );
        try {
          let user_email: string | undefined = undefined;
          let user_uuid: string | undefined = undefined;
          if (typeof window !== "undefined") {
            try {
              const raw = localStorage.getItem("userProfile");
              if (raw) {
                const parsed = JSON.parse(raw);
                user_email = parsed?.email;
                user_uuid = parsed?.user_uuid;
              }
            } catch {}
          }

          const request = {
            prompt,
            provider,
            modelId: model,
            ...(user_email && user_uuid ? { user_email, user_uuid } : {}),
          };

          const response = await fetch("/api/generate-images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || `Server error: ${response.status}`);
          }

          const completionTime = Date.now();
          const elapsed = completionTime - startTime;
          setTimings((prev) => ({
            ...prev,
            [instanceId]: {
              startTime,
              completionTime,
              elapsed,
            },
          }));

          console.log(
            `Successful image response [provider=${provider}, instanceId=${instanceId}, modelId=${model}, elapsed=${elapsed}ms]`,
          );

          // Update image in state
          setImages((prevImages) =>
            prevImages.map((item) =>
              // Match by instanceId to ensure we update the correct instance
              "instanceId" in item && item.instanceId === instanceId
                ? { ...item, image: data.image ?? null, modelId: model }
                : item,
            ),
          );
        } catch (err) {
          console.error(
            `Error [provider=${provider}, instanceId=${instanceId}, modelId=${model}]:`,
            err,
          );
          setFailedProviders((prev) => [...prev, instanceId]);
          setErrors((prev) => [
            ...prev,
            {
              provider,
              message:
                err instanceof Error
                  ? err.message
                  : "An unexpected error occurred",
              instanceId,
            },
          ]);

          setImages((prevImages) =>
            prevImages.map((item) =>
              // Match by instanceId to ensure we update the correct instance
              "instanceId" in item && item.instanceId === instanceId
                ? { ...item, image: null, modelId: model }
                : item,
            ),
          );
        }
      };

      // Generate images for all active providers
      const fetchPromises = providerInstances.map(generateImage);

      await Promise.all(fetchPromises);
    } catch (error) {
      console.error("Error fetching images:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    images,
    errors,
    timings,
    failedProviders,
    isLoading,
    startGeneration,
    resetState,
    activePrompt,
  };
}
