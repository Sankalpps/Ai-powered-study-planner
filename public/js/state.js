/**
 * @fileoverview Global Application State and localStorage Persistence
 * @module state
 */

/** @type {Array<import('../../types').EventPlan>} */
var allEvents = [];
/** @type {import('../../types').EventPlan|null} */
var activeEvent = null;
/** @type {Array<{role: string, text: string}>} */
var chatHistory = [];

/**
 * Loads persisted events from browser localStorage or initializes with default showcase events.
 */
function loadEventsFromStorage() {
  const saved = localStorage.getItem('celebo_events') || localStorage.getItem('celebrio_events');
  if (saved) {
    try {
      allEvents = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved events:', e);
      allEvents = [...SAMPLE_EVENTS];
    }
  } else {
    allEvents = [...SAMPLE_EVENTS];
    saveEventsToStorage();
  }

  const savedActiveId =
    localStorage.getItem('celebo_active_event_id') ||
    localStorage.getItem('celebrio_active_event_id');
  activeEvent = allEvents.find((e) => e.id === savedActiveId) || allEvents[0];
}

function saveEventsToStorage() {
  localStorage.setItem('celebo_events', JSON.stringify(allEvents));
  localStorage.setItem('celebrio_events', JSON.stringify(allEvents));
  if (activeEvent) {
    localStorage.setItem('celebo_active_event_id', activeEvent.id);
    localStorage.setItem('celebrio_active_event_id', activeEvent.id);
  }
}
