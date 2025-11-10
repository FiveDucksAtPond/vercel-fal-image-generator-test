import { ProviderKey } from "./provider-config";

export interface GenerateImageRequest {
  prompt: string;
  provider: ProviderKey;
  modelId: string;
  user_email?: string;
  user_uuid?: string;
}

export interface GenerateImageResponse {
  image?: string;
  error?: string;
  image_url?: string;
}
