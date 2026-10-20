/**
 * @fileoverview Celebo AI Frontend Client Service
 * Manages communication with backend Gemini AI endpoints and browser storage settings.
 * @module AIService
 */

const AIService = {
  /**
   * Retrieves user-defined custom API key from sessionStorage.
   * @returns {string} Custom API key or empty string
   */
  getCustomApiKey() {
    return (
      sessionStorage.getItem('celebo_custom_api_key') ||
      sessionStorage.getItem('celebrio_custom_api_key') ||
      ''
    );
  },

  /**
   * Persists custom API key in browser session storage.
   * @param {string} key - API Key string
   */
  setCustomApiKey(key) {
    if (key) {
      sessionStorage.setItem('celebo_custom_api_key', key.trim());
      sessionStorage.setItem('celebrio_custom_api_key', key.trim());
    } else {
      sessionStorage.removeItem('celebo_custom_api_key');
      sessionStorage.removeItem('celebrio_custom_api_key');
    }
  },

  /**
   * Gets preferred model identifier.
   * @returns {string} Model name
   */
  getSelectedModel() {
    const storedModel =
      localStorage.getItem('celebo_selected_model') ||
      localStorage.getItem('celebrio_selected_model');
    const retiredModels = {
      'gemini-1.5-flash': 'gemini-3.5-flash',
      'gemini-2.0-flash': 'gemini-3.5-flash',
      'gemini-2.0-flash-lite': 'gemini-3.5-flash-lite',
      'gemini-2.5-flash': 'gemini-3.5-flash',
      'gemini-2.5-flash-lite': 'gemini-3.5-flash-lite',
      'gemini-3.8-flash': 'gemini-3.5-flash',
      'gemini-3.8-flash-lite': 'gemini-3.5-flash-lite'
    };
    return retiredModels[storedModel] || storedModel || 'gemini-3.5-flash';
  },

  /**
   * Sets preferred model identifier.
   * @param {string} model - Model identifier
   */
  setSelectedModel(model) {
    localStorage.setItem('celebo_selected_model', model);
  },

  /**
   * Constructs HTTP request headers including optional custom API key.
   * @returns {Record<string, string>} Header map
   */
  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const customKey = this.getCustomApiKey();
    if (customKey) {
      headers['x-custom-api-key'] = customKey;
    }
    return headers;
  },

  /**
   * Sends parameters to /api/generate-plan to synthesize a full celebration plan.
   * @param {Object} formData - Event parameters
   * @returns {Promise<Object>} Structured event plan object
   * @throws {Error} If generation fails
   */
  async generateEventPlan(formData) {
    const payload = {
      ...formData,
      model: this.getSelectedModel()
    };

    const response = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  },

  /**
   * Generates a tailored speech or toast.
   * @param {Object} params - Speech parameters
   * @returns {Promise<string>} Drafted speech text
   */
  async generateSpeech(params) {
    const payload = {
      ...params,
      model: this.getSelectedModel()
    };

    const response = await fetch('/api/generate-speech', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }

    const result = await response.json();
    return result.speech;
  },

  /**
   * Generates a formal vendor inquiry email and RFP checklist.
   * @param {Object} params - Vendor details and specific requirements
   * @returns {Promise<string>} Drafted RFP inquiry email
   */
  async generateVendorRFP(params) {
    const payload = {
      ...params,
      model: this.getSelectedModel()
    };

    const response = await fetch('/api/generate-vendor-rfp', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }

    const result = await response.json();
    return result.inquiry;
  },

  /**
   * Sends conversational message with active event context to Celebo Co-Pilot.
   * @param {string} message - User chat message
   * @param {Object} eventContext - Active celebration state
   * @param {Array<{role: string, text: string}>} [history=[]] - Prior turn history
   * @returns {Promise<string>} AI assistant response text
   */
  async chatWithCopilot(message, eventContext, history = []) {
    const payload = {
      message,
      eventContext,
      history,
      model: this.getSelectedModel()
    };

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }

    const result = await response.json();
    return result.reply;
  }
};
