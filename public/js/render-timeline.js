/**
 * @fileoverview Timeline & Run of Show Tab Renderer
 * @module render-timeline
 */

// TAB 3: Timeline & Run of Show
function renderTimelineTab() {
  const milestones = activeEvent.timelineMilestones || [];
  const runOfShow = activeEvent.runOfShow || [];

  // Milestones Container
  const milestonesContainer = document.getElementById('milestones-container');
  milestonesContainer.innerHTML = '';

  milestones.forEach((m, idx) => {
    const item = document.createElement('div');
    item.className = `milestone-item ${m.done ? 'done' : ''}`;
    item.innerHTML = `
      <input type="checkbox" class="milestone-check" ${m.done ? 'checked' : ''} data-m-idx="${idx}">
      <div class="milestone-body">
        <div class="milestone-header">
          <span class="milestone-timeframe">${m.timeframe || m.phase}</span>
          <span class="badge ${m.priority === 'High' || m.priority === 'Critical' ? 'badge-inquired' : 'badge-researching'}">${m.priority || 'Normal'}</span>
        </div>
        <div class="milestone-task">${m.task}</div>
      </div>
      <button class="btn btn-outline btn-sm btn-delete-milestone" data-m-idx="${idx}" title="Delete milestone">✕</button>
    `;
    milestonesContainer.appendChild(item);
  });

  // Run of Show List
  const runContainer = document.getElementById('run-of-show-container');
  runContainer.innerHTML = '';

  runOfShow.forEach((r) => {
    const item = document.createElement('div');
    item.className = 'run-item';
    item.innerHTML = `
      <div class="run-time">${r.time}</div>
      <div>
        <div class="run-activity">${r.activity}</div>
        <div class="run-notes">${r.notes || ''} ${r.location ? `• 📍 ${r.location}` : ''}</div>
      </div>
      <div class="run-lead">
        <span>👤 ${r.lead || 'Coordinator'}</span>
      </div>
    `;
    runContainer.appendChild(item);
  });
}

function toggleMilestoneDone(idx, isDone) {
  if (activeEvent?.timelineMilestones?.[idx]) {
    activeEvent.timelineMilestones[idx].done = isDone;
    saveEventsToStorage();
    renderTimelineTab();
    renderHeroAndMetrics();
    showToast(isDone ? 'Marked task as done! 🎉' : 'Task marked pending.');
  }
}

function deleteMilestone(idx) {
  activeEvent.timelineMilestones.splice(idx, 1);
  saveEventsToStorage();
  renderTimelineTab();
  renderHeroAndMetrics();
  showToast('Milestone removed.');
}

/**
 * Initializes button listeners for milestone creation and run of show additions.
 */
function initTimelineListeners() {
  const addMilestoneBtn = document.getElementById('btn-add-milestone');
  if (addMilestoneBtn) {
    addMilestoneBtn.addEventListener('click', () => {
      const task = prompt('Enter new planning milestone task:');
      if (task && task.trim()) {
        activeEvent.timelineMilestones.push({
          id: 'm_' + Date.now(),
          timeframe: 'Custom Milestone',
          phase: 'Custom',
          task: task.trim(),
          priority: 'Medium',
          done: false
        });
        saveEventsToStorage();
        renderTimelineTab();
        renderHeroAndMetrics();
        showToast('Added new milestone!');
      }
    });
  }

  const addRunItemBtn = document.getElementById('btn-add-run-item');
  if (addRunItemBtn) {
    addRunItemBtn.addEventListener('click', () => {
      const time = prompt('Enter time cue (e.g. "04:30 PM"):', '04:30 PM');
      if (!time) return;
      const activity = prompt('Enter activity description:');
      if (!activity) return;
      const lead = prompt('Enter lead / coordinator:', 'Host');

      activeEvent.runOfShow.push({
        time,
        activity,
        lead: lead || 'Host',
        location: 'Venue',
        notes: ''
      });
      saveEventsToStorage();
      renderTimelineTab();
      showToast('Added Run of Show cue!');
    });
  }
}
