/**
 * @fileoverview Overview Moodboard and Creative Studio Tab Renderers
 * @module render-creative
 */

// TAB 1: Overview & Moodboard
function renderOverviewTab() {
  const theme = activeEvent.theme || {};
  const summary = activeEvent.summary || {};

  document.getElementById('overview-theme-concept-badge').textContent =
    theme.conceptName || 'Theme';
  document.getElementById('overview-theme-desc').textContent =
    theme.description || summary.aesthetic || 'No description provided.';
  document.getElementById('overview-vision-statement').textContent =
    `"${summary.keyVision || theme.description || 'Creating an unforgettable celebration.'}"`;

  const paletteContainer = document.getElementById('overview-palette-container');
  paletteContainer.innerHTML = '';
  (theme.colorPalette || []).forEach((color) => {
    const box = document.createElement('div');
    box.className = 'swatch-box';
    box.setAttribute('role', 'button');
    box.setAttribute('tabindex', '0');
    box.setAttribute(
      'aria-label',
      `Color ${color.name}, hex code ${color.hex}. Press Enter or click to copy.`
    );
    box.title = `Click to copy ${color.hex}: ${color.usage || ''}`;
    box.innerHTML = `
      <div class="swatch-color" style="background-color: ${color.hex};"></div>
      <div class="swatch-info">
        <div class="swatch-name">${color.name}</div>
        <div class="swatch-hex">${color.hex}</div>
      </div>
    `;

    const copyColor = () => {
      navigator.clipboard.writeText(color.hex);
      showToast(`Copied ${color.hex} (${color.name}) to clipboard!`);
    };

    box.addEventListener('click', copyColor);
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        copyColor();
      }
    });

    paletteContainer.appendChild(box);
  });

  const drink = theme.signatureDrink || {};
  document.getElementById('overview-drink-name').textContent = drink.name || 'Signature Cocktail';
  document.getElementById('overview-drink-recipe').textContent =
    drink.recipe || 'Custom mix created for your guests.';
  document.getElementById('overview-drink-mocktail').textContent = drink.mocktailAlternative
    ? `🌱 Mocktail Alternative: ${drink.mocktailAlternative}`
    : 'Mocktail alternative available upon request.';

  const decorList = document.getElementById('overview-decor-list');
  decorList.innerHTML = '';
  (theme.decorHighlights || []).forEach((highlight) => {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.alignItems = 'flex-start';
    li.style.gap = '0.5rem';
    li.innerHTML = `<span style="color: var(--primary);">✦</span> <span>${highlight}</span>`;
    decorList.appendChild(li);
  });

  document.getElementById('overview-music-vibe').textContent =
    theme.musicVibe || 'Curated ambient & celebration soundtrack.';
}

// TAB 5: Creative Studio (Speeches, Invitations, Activities)
function renderCreativeTab() {
  const ideas = activeEvent.personalizedIdeas || {};
  const invite = ideas.invitationCopy || {};
  const activities = ideas.signatureActivities || [];

  // Invitation
  document.getElementById('invite-headline').textContent =
    invite.headline || 'YOU ARE CORDIALLY INVITED';
  document.getElementById('invite-opening').textContent =
    invite.opening || 'Join us for a celebration of joy and community.';
  document.getElementById('invite-details').textContent =
    invite.details ||
    `${formatDate(activeEvent.summary?.eventDate)} • ${activeEvent.summary?.location || 'Venue'}`;
  document.getElementById('invite-rsvp').textContent =
    invite.rsvpNote || 'Kindly RSVP by 4 weeks prior to the celebration.';
  document.getElementById('invite-dress-code').textContent = invite.dressCodeAdvice
    ? `Dress Code: ${invite.dressCodeAdvice}`
    : '';

  // Signature Activities
  const activitiesContainer = document.getElementById('activities-container');
  activitiesContainer.innerHTML = '';

  activities.forEach((act) => {
    const card = document.createElement('div');
    card.style.background = 'var(--bg-card-subtle)';
    card.style.border = '1px solid var(--border)';
    card.style.borderRadius = 'var(--radius-md)';
    card.style.padding = '1rem';
    card.innerHTML = `
      <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem; margin-bottom: 0.35rem;">
        🎯 ${act.title}
      </div>
      <div style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 0.4rem;">
        ${act.description}
      </div>
      ${act.supplies ? `<div style="font-size: 0.78rem; color: var(--primary); font-weight: 500;">📦 Supplies: ${act.supplies}</div>` : ''}
    `;
    activitiesContainer.appendChild(card);
  });
}

/**
 * Initializes button and form listeners for creative studio (invitations and speeches).
 */
function initCreativeListeners() {
  const copyInviteBtn = document.getElementById('btn-copy-invite');
  if (copyInviteBtn) {
    copyInviteBtn.addEventListener('click', () => {
      const invite = activeEvent?.personalizedIdeas?.invitationCopy || {};
      const text = `${invite.headline || ''}\n\n${invite.opening || ''}\n\n${invite.details || ''}\n\n${invite.rsvpNote || ''}\n${invite.dressCodeAdvice ? `Dress code: ${invite.dressCodeAdvice}` : ''}`;
      copyWithFeedback(copyInviteBtn, text, 'Invitation copy copied to clipboard!');
    });
  }

  const speechForm = document.getElementById('form-speech-generator');
  if (speechForm) {
    speechForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-generate-speech');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Writing Speech with Gemini...';

      const params = {
        speechType: document.getElementById('speech-type').value,
        tone: document.getElementById('speech-tone').value,
        speakerName: document.getElementById('speech-speaker').value,
        honoreeName: document.getElementById('speech-honoree').value,
        keyMemories: document.getElementById('speech-memories').value
      };

      try {
        const speech = await AIService.generateSpeech(params);
        document.getElementById('speech-text').textContent = speech;
        document.getElementById('speech-result-box').style.display = 'block';
        showToast('Speech drafted successfully!');
      } catch (err) {
        alert('Speech generation failed: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  }

  const copySpeechBtn = document.getElementById('btn-copy-speech');
  if (copySpeechBtn) {
    copySpeechBtn.addEventListener('click', () => {
      const speechText = document.getElementById('speech-text').textContent;
      copyWithFeedback(copySpeechBtn, speechText, 'Speech copied to clipboard!');
    });
  }
}
