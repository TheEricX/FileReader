import React from 'react';

const ModelSettingsPanel = ({
  title,
  description,
  groupedModelOptions,
  modelOptions,
  settingsModelId,
  onSelectModel,
  onClose,
  onBack,
  onReset,
  currentSettings,
  customModelIds,
  onCustomModelIdChange,
  onParamChange,
  noteText,
}) => {
  return (
    <div className="model-settings-panel">
      <div className="model-settings-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      {!settingsModelId ? (
        <div className="model-settings-groups">
          {groupedModelOptions.map((group) => (
            <section key={group.id} className="model-settings-group">
              <div className="model-settings-group-header">
                <h3>{group.title}</h3>
                <span>{group.models.length} models</span>
              </div>
              <div className="model-settings-chooser">
                {group.models.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    className="model-option"
                    onClick={() => onSelectModel(model.id)}
                  >
                    <span>{model.label}</span>
                    <small>{model.custom ? 'custom' : model.provider}</small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (() => {
        const settingsModel = modelOptions.find((model) => model.id === settingsModelId);
        const activeSettings = currentSettings;
        return (
          <div className="model-settings-detail">
            <div className="model-settings-controls">
              <button
                type="button"
                className="model-settings-back"
                onClick={onBack}
              >
                Back
              </button>
              <button
                type="button"
                className="model-settings-reset"
                onClick={onReset}
              >
                Reset to default
              </button>
            </div>
            <div className="model-settings-meta">
              <div>
                <h3>{settingsModel?.label}</h3>
                <p>{settingsModel?.custom ? `Custom ${settingsModel?.provider} model configuration` : `Provider: ${settingsModel?.provider}`}</p>
              </div>
            </div>
            {settingsModel?.custom && (
              <div className="model-setting-row model-setting-row-wide">
                <label htmlFor="param-custom-model-id">Model ID</label>
                <input
                  id="param-custom-model-id"
                  type="text"
                  placeholder={`Enter ${settingsModel.provider} model id`}
                  value={customModelIds[settingsModel.customKey] || ''}
                  onChange={(event) => onCustomModelIdChange(settingsModel.customKey, event.target.value)}
                />
              </div>
            )}
            <div className="model-settings-form-grid">
              <div className="model-setting-row">
                <label htmlFor="param-temperature">Temperature</label>
                <input
                  id="param-temperature"
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={activeSettings.temperature}
                  onChange={(event) => onParamChange('temperature', event.target.value, 'float')}
                />
              </div>
              <div className="model-setting-row">
                <label htmlFor="param-maxTokens">Max tokens</label>
                <input
                  id="param-maxTokens"
                  type="number"
                  min="256"
                  max="8192"
                  step="128"
                  value={activeSettings.maxTokens}
                  onChange={(event) => onParamChange('maxTokens', event.target.value, 'int')}
                />
              </div>
              <div className="model-setting-row">
                <label htmlFor="param-topP">Top P</label>
                <input
                  id="param-topP"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={activeSettings.topP}
                  onChange={(event) => onParamChange('topP', event.target.value, 'float')}
                />
              </div>
              <div className="model-setting-row">
                <label htmlFor="param-presencePenalty">Presence penalty</label>
                <input
                  id="param-presencePenalty"
                  type="number"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={activeSettings.presencePenalty}
                  onChange={(event) => onParamChange('presencePenalty', event.target.value, 'float')}
                />
              </div>
              <div className="model-setting-row">
                <label htmlFor="param-frequencyPenalty">Frequency penalty</label>
                <input
                  id="param-frequencyPenalty"
                  type="number"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={activeSettings.frequencyPenalty}
                  onChange={(event) => onParamChange('frequencyPenalty', event.target.value, 'float')}
                />
              </div>
            </div>
            <p className="model-settings-note">{noteText}</p>
          </div>
        );
      })()}
    </div>
  );
};

export default ModelSettingsPanel;
