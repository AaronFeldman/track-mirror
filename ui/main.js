const invoke = window.__TAURI__.core.invoke;

const listenerInput = document.querySelector('#listener');
const trackUriInput = document.querySelector('#track-uri');
const playingInput = document.querySelector('#is-playing');
const statusOutput = document.querySelector('#status');
const actionOutput = document.querySelector('#action');

let sequence = 1;

function show(output, value) {
  output.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

async function refreshStatus() {
  try {
    show(statusOutput, await invoke('engine_status'));
  } catch (error) {
    show(statusOutput, String(error));
  }
}

document.querySelector('#select-listener').addEventListener('click', async () => {
  try {
    show(statusOutput, await invoke('select_listener', { listener: listenerInput.value.trim() }));
  } catch (error) {
    show(statusOutput, String(error));
  }
});

document.querySelector('#arm').addEventListener('click', async () => {
  try {
    show(statusOutput, await invoke('arm_mirroring'));
  } catch (error) {
    show(statusOutput, String(error));
  }
});

document.querySelector('#disarm').addEventListener('click', async () => {
  try {
    show(statusOutput, await invoke('disarm_mirroring'));
  } catch (error) {
    show(statusOutput, String(error));
  }
});

document.querySelector('#send-event').addEventListener('click', async () => {
  const event = {
    version: 1,
    source_listener_id: listenerInput.value.trim(),
    track_uri: trackUriInput.value.trim(),
    track_title: null,
    artists: [],
    album: null,
    is_playing: playingInput.checked,
    position_ms: null,
    observed_at: new Date().toISOString(),
    sequence: sequence++,
    provenance: 'manual-test',
    confidence: 'exact-uri'
  };

  try {
    show(actionOutput, await invoke('process_mirror_event', { event }));
    await refreshStatus();
  } catch (error) {
    show(actionOutput, String(error));
  }
});

refreshStatus();
