const invoke = window.__TAURI__.core.invoke;

const spotifyClientIdInput = document.querySelector('#spotify-client-id');
const spotifyRedirectUriInput = document.querySelector('#spotify-redirect-uri');
const spotifyStatusOutput = document.querySelector('#spotify-status');
const mediaSessionTrackUriInput = document.querySelector('#media-session-track-uri');
const mediaSessionOutput = document.querySelector('#media-session-output');
const listenerInput = document.querySelector('#listener');
const trackUriInput = document.querySelector('#track-uri');
const playingInput = document.querySelector('#is-playing');
const statusOutput = document.querySelector('#status');
const actionOutput = document.querySelector('#action');

let sequence = 1;

spotifyClientIdInput.value = localStorage.getItem('track-mirror.spotify-client-id') || '';
mediaSessionTrackUriInput.value = localStorage.getItem('track-mirror.mediasession-track-uri') || '';

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

document.querySelector('#configure-spotify').addEventListener('click', async () => {
  const clientId = spotifyClientIdInput.value.trim();
  if (!clientId) {
    show(spotifyStatusOutput, 'Enter the Track Mirror Spotify client ID first.');
    return;
  }

  localStorage.setItem('track-mirror.spotify-client-id', clientId);

  try {
    show(spotifyStatusOutput, await invoke('configure_spotify', {
      clientId,
      redirectUri: spotifyRedirectUriInput.value.trim()
    }));
  } catch (error) {
    show(spotifyStatusOutput, String(error));
  }
});

document.querySelector('#connect-spotify').addEventListener('click', async () => {
  try {
    show(spotifyStatusOutput, await invoke('connect_spotify'));
  } catch (error) {
    show(spotifyStatusOutput, String(error));
  }
});

document.querySelector('#disconnect-spotify').addEventListener('click', async () => {
  try {
    show(spotifyStatusOutput, await invoke('disconnect_spotify'));
  } catch (error) {
    show(spotifyStatusOutput, String(error));
  }
});

document.querySelector('#media-session-access').addEventListener('click', async () => {
  try {
    show(mediaSessionOutput, await invoke('android_open_media_control_access'));
  } catch (error) {
    show(mediaSessionOutput, String(error));
  }
});

document.querySelector('#media-session-status').addEventListener('click', async () => {
  try {
    show(mediaSessionOutput, await invoke('android_media_session_status'));
  } catch (error) {
    show(mediaSessionOutput, String(error));
  }
});

document.querySelector('#media-session-play').addEventListener('click', async () => {
  const trackUri = mediaSessionTrackUriInput.value.trim();
  if (!trackUri.startsWith('spotify:track:')) {
    show(mediaSessionOutput, 'Paste an exact spotify:track: URI first.');
    return;
  }

  localStorage.setItem('track-mirror.mediasession-track-uri', trackUri);

  try {
    show(mediaSessionOutput, await invoke('android_play_track_via_media_session', { trackUri }));
  } catch (error) {
    show(mediaSessionOutput, String(error));
  }
});

document.querySelector('#media-session-pause').addEventListener('click', async () => {
  try {
    show(mediaSessionOutput, await invoke('android_pause_via_media_session'));
  } catch (error) {
    show(mediaSessionOutput, String(error));
  }
});

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
    show(actionOutput, await invoke('process_and_apply_mirror_event', { event }));
    await refreshStatus();
  } catch (error) {
    show(actionOutput, String(error));
  }
});

refreshStatus();
