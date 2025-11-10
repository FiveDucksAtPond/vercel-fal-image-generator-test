"use client";

import { useState, useEffect, useRef } from "react";
import { ModelSelect } from "@/components/ModelSelect";
import { PromptInput } from "@/components/PromptInput";
import { ModelCardCarousel } from "@/components/ModelCardCarousel";
import {
  MODEL_CONFIGS,
  PROVIDERS,
  PROVIDER_ORDER,
  ProviderKey,
  ModelMode,
} from "@/lib/provider-config";
import { Suggestion } from "@/lib/suggestions";
import { useImageGeneration } from "@/hooks/use-image-generation";
import { Header } from "./Header";
import { HomeGallery } from "@/components/HomeGallery";

interface ProviderInstance {
  id: string;
  providerKey: ProviderKey;
  model: string;
  enabled: boolean;
}

export function ImagePlayground({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  const {
    images,
    timings,
    failedProviders,
    isLoading,
    startGeneration,
    activePrompt,
  } = useImageGeneration();

  const [showProviders, setShowProviders] = useState(false);
  const [providerInstances, setProviderInstances] = useState<ProviderInstance[]>(
    PROVIDER_ORDER.flatMap((key) => [
      {
        id: `${key}-1`,
        providerKey: key,
        model: MODEL_CONFIGS.performance[key],
        enabled: true,
      },
      {
        id: `${key}-2`,
        providerKey: key,
        model: MODEL_CONFIGS.quality[key],
        enabled: true,
      },
    ])
  );
  const [mode, setMode] = useState<ModelMode>("performance");

  // Track which prompt we have auto-scrolled for to avoid repeated scrolling
  const lastScrolledPromptRef = useRef<string | null>(null);
  // Container that wraps the output frames; used to center on screen
  const outputFramesRef = useRef<HTMLDivElement | null>(null);

  const toggleView = () => {
    setShowProviders((prev) => !prev);
  };

  const handleModeChange = (newMode: ModelMode) => {
    setMode(newMode);
    setProviderInstances((prev) =>
      prev.map((instance) => ({
        ...instance,
        model: MODEL_CONFIGS[newMode][instance.providerKey],
      }))
    );
    setShowProviders(true);
  };

  const handleModelChange = (instanceId: string, model: string) => {
    setProviderInstances((prev) =>
      prev.map((instance) =>
        instance.id === instanceId ? { ...instance, model } : instance
      )
    );
  };

  const handleProviderToggle = (instanceId: string, enabled: boolean) => {
    setProviderInstances((prev) =>
      prev.map((instance) =>
        instance.id === instanceId ? { ...instance, enabled } : instance
      )
    );
  };

  const handlePromptSubmit = (newPrompt: string) => {
    const activeInstances = providerInstances.filter((instance) => instance.enabled);
    if (activeInstances.length > 0) {
      // Create provider instances in the format expected by startGeneration
      const providerInstancesForGeneration = activeInstances.map(instance => ({
        provider: instance.providerKey,
        instanceId: instance.id,
        model: instance.model
      }));
      
      // Start generation with all provider instances
      startGeneration(newPrompt, providerInstancesForGeneration);
    }
    setShowProviders(false);
  };

  // Smoothly scroll to the output frames when a new prompt is set
  useEffect(() => {
    if (!activePrompt) return;
    if (lastScrolledPromptRef.current === activePrompt) return;
    // Defer to next paint so the output frames are in the DOM
    const id = requestAnimationFrame(() => {
      const el = outputFramesRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const targetY = window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2;
      const clamped = Math.max(0, targetY);
      window.scrollTo({ top: clamped, behavior: "smooth" });
      lastScrolledPromptRef.current = activePrompt;
    });
    return () => cancelAnimationFrame(id);
  }, [activePrompt]);

  const getModelProps = () => {
    return providerInstances.map((instance) => {
      const provider = PROVIDERS[instance.providerKey];
      const imageItem = images.find((img) => 
        img.provider === instance.providerKey && 
        "instanceId" in img && img.instanceId === instance.id
      );
      const imageData = imageItem?.image;
      const modelId = imageItem?.modelId ?? "N/A";
      const timing = timings[instance.id] || {};

      return {
        label: `${provider.displayName} ${instance.id.split('-')[1]}`,
        models: provider.models,
        value: instance.model,
        providerKey: instance.providerKey,
        onChange: (model: string) => handleModelChange(instance.id, model),
        iconPath: provider.iconPath,
        color: provider.color,
        enabled: instance.enabled,
        onToggle: (enabled: boolean) => handleProviderToggle(instance.id, enabled),
        image: imageData,
        modelId,
        timing,
        failed: failedProviders.includes(instance.id),
      };
    });
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Header />
        <div className="flex items-center justify-center min-h-[100vh]">
          <PromptInput
            onSubmit={handlePromptSubmit}
            isLoading={isLoading}
            showProviders={showProviders}
            onToggleProviders={toggleView}
            mode={mode}
            onModeChange={handleModeChange}
            suggestions={suggestions}
          />
        </div>
      </div>
      {/* Prompt output area shown after a generation is requested */}
      <div className="max-w-7xl mx-auto">
        {activePrompt && activePrompt.length > 0 && (
          <>
            <div ref={outputFramesRef}>
              <div className="md:hidden">
                <ModelCardCarousel models={getModelProps()} />
              </div>
              <div className="hidden md:grid md:grid-cols-2 gap-8">
                {getModelProps().map((props) => (
                  <ModelSelect key={props.label} {...props} />
                ))}
              </div>
            </div>
            <div className="panel-dark mt-6 p-4 md:p-5 text-white">
              <div className="text-xs uppercase tracking-wide text-white/70 mb-1">
                Your Prompt{isLoading ? " (Generating...)" : ":"}
              </div>
              <div className="text-sm md:text-base whitespace-pre-wrap">
                {activePrompt}
              </div>
            </div>
          </>
        )}
      </div>
      {/* Constrained semi-transparent background for Community Gallery */}
      <section className="max-w-7xl mx-auto py-10 pb-16 px-4 sm:px-6 lg:px-8">
        <h2 className="text-lg font-semibold mb-3">Community Creations</h2>
        <p className="text-sm text-black mb-4">Scroll to explore recent images from the community.</p>
        <div className="bg-white/50">
          {/* Lazy, infinite-scroll grid of user's generated images (appears below the fold) */}
          {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
          {/* @ts-ignore */}
          <HomeGallery />
        </div>
      </section>
      <div className="max-w-7xl mx-auto"></div>
    </div>
  );
}
