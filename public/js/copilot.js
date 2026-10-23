/**
 * @fileoverview Celebo Co-Pilot Chat Message Handler
 * @module copilot
 */

/**
 * Handles sending a message to the Co-Pilot AI and rendering the response.
 * @param {string} userMessage - The user's message text
 */
async function handleCopilotMessage(userMessage) {
  const messagesContainer = document.getElementById('copilot-messages');

  // Append user bubble
  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble chat-bubble-user';
  userBubble.textContent = userMessage;
  messagesContainer.appendChild(userBubble);

  // Append typing indicator
  const aiBubble = document.createElement('div');
  aiBubble.className = 'chat-bubble chat-bubble-ai';
  aiBubble.innerHTML = '<em>Thinking with Gemini...</em>';
  messagesContainer.appendChild(aiBubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const reply = await AIService.chatWithCopilot(userMessage, activeEvent, chatHistory);
    aiBubble.innerHTML = formatMarkdown(reply);

    chatHistory.push({ role: 'user', text: userMessage });
    chatHistory.push({ role: 'model', text: reply });
  } catch (err) {
    aiBubble.innerHTML = `<span style="color: var(--danger);">⚠️ ${err.message}</span>`;
  }

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Initializes form submission and quick-action chips for Co-Pilot.
 */
function initCopilotListeners() {
  const form = document.getElementById('copilot-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('copilot-input');
      const msg = input.value.trim();
      if (!msg) return;

      input.value = '';
      await handleCopilotMessage(msg);
    });
  }

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', async () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        const copilotTab = document.querySelector('[data-tab="tab-copilot"]');
        if (copilotTab) copilotTab.click();
        await handleCopilotMessage(prompt);
      }
    });
  });
}
