export type ProviderKey = "replicate";
export type ModelMode = "performance" | "quality";

export const PROVIDERS: Record<
  ProviderKey,
  {
    displayName: string;
    iconPath: string;
    color: string;
    models: string[];
  }
> = {
  replicate: {
    displayName: "Replicate",
    iconPath: "/provider-icons/replicate.svg",
    color: "from-blue-500 to-cyan-500",
    models: [
      "black-forest-labs/flux-schnell",
      "stability-ai/sdxl",
      "black-forest-labs/flux-1.1-pro",
    ],
  },
};

export const MODEL_CONFIGS: Record<ModelMode, Record<ProviderKey, string>> = {
  performance: {
    replicate: "black-forest-labs/flux-schnell",
  },
  quality: {
    replicate: "black-forest-labs/flux-1.1-pro",
  },
};

export const PROVIDER_ORDER: ProviderKey[] = ["replicate"];

export const initializeProviderRecord = <T>(defaultValue?: T) =>
  Object.fromEntries(
    PROVIDER_ORDER.map((key) => [key, defaultValue]),
  ) as Record<ProviderKey, T>;
