use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigureRequest {
    pub client_id: String,
    pub redirect_uri: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayTrackRequest {
    pub track_uri: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorizationCallbackRequest {
    pub url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackResponse {
    pub ok: bool,
    pub connected: bool,
    #[serde(default)]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AndroidMediaSessionResponse {
    pub ok: bool,
    pub access_granted: bool,
    pub spotify_session_found: bool,
    #[serde(default)]
    pub spotify_package: Option<String>,
    #[serde(default)]
    pub playback_state: Option<String>,
    #[serde(default)]
    pub track_title: Option<String>,
    #[serde(default)]
    pub artist: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
}
