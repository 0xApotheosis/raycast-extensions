import { ActionPanel, Action, Form, showToast, Toast, LocalStorage } from "@raycast/api";
import { useEffect, useState } from "react";

import type { ModelSettings, VeniceModel } from "./types";

interface AdvancedSettingsFormProps {
  model: VeniceModel;
  onRefresh?: () => void;
}

export default function AdvancedSettingsForm({ model, onRefresh }: AdvancedSettingsFormProps) {
  const [settings, setSettings] = useState<ModelSettings>({
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    maxTokens: 2048,
  });
  const [temperatureInput, setTemperatureInput] = useState(settings.temperature.toString());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await LocalStorage.getItem<string>(`venice_settings_${model.id}`);
        if (saved) {
          const parsed = JSON.parse(saved) as ModelSettings;
          setSettings(parsed);
          setTemperatureInput(parsed.temperature.toString());
        }
      } catch {
        // Use defaults if parsing fails
      } finally {
        setIsLoading(false);
      }
    })();
  }, [model.id]);

  // Sync temperatureInput when settings change (but not during user input)
  useEffect(() => {
    setTemperatureInput(settings.temperature.toString());
  }, [settings.temperature]);

  function validateSettings(): string | null {
    // Validate temperature
    if (settings.temperature !== undefined) {
      if (typeof settings.temperature !== 'number' || isNaN(settings.temperature) || settings.temperature < 0 || settings.temperature > 2) {
        return "Temperature must be a number between 0.0 and 2.0";
      }
    }

    // Validate topP
    if (settings.topP !== undefined) {
      if (typeof settings.topP !== 'number' || isNaN(settings.topP) || settings.topP < 0 || settings.topP > 1) {
        return "Top P must be a number between 0.0 and 1.0";
      }
    }

    // Validate topK
    if (settings.topK !== undefined) {
      if (!Number.isInteger(settings.topK) || settings.topK < 1) {
        return "Top K must be an integer greater than 0";
      }
    }

    // Validate maxTokens
    if (settings.maxTokens !== undefined) {
      if (!Number.isInteger(settings.maxTokens) || settings.maxTokens < 1) {
        return "Max Tokens must be an integer greater than 0";
      }
    }

    return null; // No validation errors
  }

  async function saveSettings() {
    // Validate settings before saving
    const validationError = validateSettings();
    if (validationError) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Invalid settings",
        message: validationError,
      });
      return;
    }

    try {
      await LocalStorage.setItem(`venice_settings_${model.id}`, JSON.stringify(settings));
      await showToast({
        style: Toast.Style.Success,
        title: "Settings saved",
        message: `Advanced settings saved for ${model.name || model.id}`,
      });
      onRefresh?.();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to save settings",
        message: String(error),
      });
    }
  }

  async function resetToDefaults() {
    const defaults: ModelSettings = {
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxTokens: 2048,
    };
    setSettings(defaults);
    setTemperatureInput(defaults.temperature.toString());
    try {
      await LocalStorage.removeItem(`venice_settings_${model.id}`);
      await showToast({
        style: Toast.Style.Success,
        title: "Settings reset",
        message: "Advanced settings reset to defaults",
      });
      onRefresh?.();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to reset settings",
        message: String(error),
      });
    }
  }

  if (isLoading) {
    return <Form isLoading={true} />;
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action title="Save Settings" onAction={saveSettings} />
          <Action title="Reset to Defaults" onAction={resetToDefaults} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="temperature"
        title="Temperature"
        placeholder="0.0 - 2.0"
        value={temperatureInput}
        onChange={(value) => {
          setTemperatureInput(value);

          // Only update settings if we have a valid complete number within bounds
          if (value.trim() !== "") {
            const parsed = parseFloat(value);
            if (!isNaN(parsed) && isFinite(parsed) && value === parsed.toString() && parsed >= 0 && parsed <= 2) {
              setSettings((prev) => ({ ...prev, temperature: parsed }));
            }
          }
        }}
        info="Controls randomness in the output. Higher values (0.8-1.2) make output more random, lower values (0.2-0.5) make it more focused and deterministic."
      />

      <Form.TextField
        id="top_p"
        title="Top P"
        placeholder="0.0 - 1.0"
        value={settings.topP?.toString() || ""}
        onChange={(value) => {
          if (value.trim() === "") {
            setSettings((prev) => ({ ...prev, topP: undefined }));
          } else {
            const parsed = parseFloat(value);
            if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
              setSettings((prev) => ({ ...prev, topP: parsed }));
            }
          }
        }}
        info="Nucleus sampling. Only tokens comprising the top-p probability mass are considered for sampling. Lower values focus on more probable tokens."
      />

      <Form.TextField
        id="top_k"
        title="Top K"
        placeholder="1 - 100"
        value={settings.topK?.toString() || ""}
        onChange={(value) => {
          if (value.trim() === "") {
            setSettings((prev) => ({ ...prev, topK: undefined }));
          } else {
            const parsed = parseInt(value);
            if (!isNaN(parsed) && parsed >= 1) {
              setSettings((prev) => ({ ...prev, topK: parsed }));
            }
          }
        }}
        info="Top-K sampling. Only the top-k most likely tokens are considered for sampling. Lower values focus on more probable tokens."
      />

      <Form.TextField
        id="max_tokens"
        title="Max Tokens"
        placeholder="1 - context window"
        value={settings.maxTokens?.toString() || ""}
        onChange={(value) => {
          if (value.trim() === "") {
            setSettings((prev) => ({ ...prev, maxTokens: undefined }));
          } else {
            const parsed = parseInt(value);
            if (!isNaN(parsed) && parsed >= 1) {
              setSettings((prev) => ({ ...prev, maxTokens: parsed }));
            }
          }
        }}
        info="Maximum number of tokens to generate in the response. Leave empty for model default."
      />
    </Form>
  );
}
