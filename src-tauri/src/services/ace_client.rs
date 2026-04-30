use reqwest::blocking::Client;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::models::{
    errors::{AppError, AppResult},
    generation::{GenerationRequest, PromptEnhancementResult},
};

const HEALTH_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(20);
const LIST_MODELS_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);
const RELEASE_TASK_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(900);
const TASK_QUERY_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(900);
const AUDIO_DOWNLOAD_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(180);

#[derive(Debug, Deserialize)]
struct AceEnvelope<T> {
    data: T,
    code: i64,
    error: Option<String>,
    timestamp: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AceReleasedTask {
    pub task_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AceTaskResult {
    pub task_id: String,
    pub state: AceTaskState,
    pub raw_result: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum AceTaskState {
    Running,
    Succeeded { file_path: String },
    Failed { error: AppError },
}

pub struct AceClient {
    base_url: String,
    http: Client,
}

impl AceClient {
    pub fn new(port: u16) -> AppResult<Self> {
        let http = Client::builder()
            .build()
            .map_err(|error| AppError::task_submit_failed(error.to_string()))?;

        Ok(Self {
            base_url: format!("http://127.0.0.1:{port}"),
            http,
        })
    }

    #[cfg(test)]
    fn from_base_url(base_url: String) -> AppResult<Self> {
        let http = Client::builder()
            .build()
            .map_err(|error| AppError::task_submit_failed(error.to_string()))?;

        Ok(Self { base_url, http })
    }

    pub fn health(&self) -> AppResult<()> {
        let response = self
            .http
            .get(format!("{}/health", self.base_url))
            .timeout(HEALTH_TIMEOUT)
            .send()
            .map_err(|error| AppError::backend_health_timeout(error.to_string()))?;

        if response.status().is_success() {
            return Ok(());
        }

        Err(AppError::backend_health_timeout(format!(
            "health endpoint returned status {}",
            response.status()
        )))
    }

    pub fn list_models(&self) -> AppResult<Vec<String>> {
        let payload: Value = self.get_envelope("/v1/models")?;
        let model_value = payload
            .get("data")
            .or_else(|| payload.get("models"))
            .cloned()
            .unwrap_or(payload);

        let models = match model_value {
            Value::Array(items) => items
                .into_iter()
                .filter_map(|item| match item {
                    Value::String(value) => Some(value),
                    Value::Object(map) => map
                        .get("name")
                        .or_else(|| map.get("model"))
                        .or_else(|| map.get("id"))
                        .and_then(Value::as_str)
                        .map(str::to_owned),
                    _ => None,
                })
                .collect(),
            _ => Vec::new(),
        };

        Ok(models)
    }

    pub fn release_task(&self, request: &GenerationRequest) -> AppResult<AceReleasedTask> {
        let payload = json!({
            "prompt": request.prompt,
            "negative_prompt": request.negative_prompt,
            "lyrics": request.lyrics,
            "vocal_language": request.vocal_language,
            "audio_duration": request.duration_seconds,
            "bpm": request.bpm,
            "key_scale": request.key_scale,
            "time_signature": request.time_signature,
            "audio_format": request.audio_format,
            "model": request.model,
            "task_type": request.task_type,
            "lm_model_path": request.lm_model_path,
            "lm_backend": request.lm_backend,
            "thinking": request.thinking,
            "inference_steps": request.inference_steps,
            "guidance_scale": request.guidance_scale,
            "use_format": request.use_format,
            "use_cot_caption": request.use_cot_caption,
            "use_cot_language": request.use_cot_language,
            "constrained_decoding": request.constrained_decoding,
            "reference_audio_path": request.reference_audio_path,
            "src_audio_path": request.src_audio_path,
            "instruction": request.instruction,
            "repainting_start": request.repainting_start,
            "repainting_end": request.repainting_end,
            "audio_cover_strength": request.audio_cover_strength,
            "use_random_seed": request.use_random_seed,
            "seed": request.seed.unwrap_or(-1),
            "batch_size": 1,
        });

        let envelope: AceEnvelope<Value> = self.post_envelope(
            "/release_task",
            &payload,
            RELEASE_TASK_TIMEOUT,
            AppError::task_submit_failed,
        )?;
        Self::ensure_success(&envelope, AppError::task_submit_failed)?;

        let task_id = envelope
            .data
            .get("task_id")
            .and_then(Value::as_str)
            .map(str::to_owned)
            .or_else(|| {
                envelope
                    .data
                    .get("task_ids")
                    .and_then(Value::as_array)
                    .and_then(|items| items.first())
                    .and_then(Value::as_str)
                    .map(str::to_owned)
            })
            .ok_or_else(|| {
                AppError::task_submit_failed(
                    "release_task did not return a task_id or task_ids field",
                )
            })?;

        Ok(AceReleasedTask { task_id })
    }

    pub fn format_input(&self, request: &GenerationRequest) -> AppResult<PromptEnhancementResult> {
        let param_obj = json!({
            "duration": request.duration_seconds,
            "bpm": request.bpm,
            "key": request.key_scale,
            "time_signature": request.time_signature,
            "language": request.vocal_language,
        });
        let payload = json!({
            "prompt": request.prompt,
            "lyrics": request.lyrics,
            "temperature": 0.85,
            "param_obj": param_obj.to_string(),
        });
        let envelope: AceEnvelope<Value> = self.post_envelope(
            "/format_input",
            &payload,
            RELEASE_TASK_TIMEOUT,
            AppError::task_submit_failed,
        )?;
        Self::ensure_success(&envelope, AppError::task_submit_failed)?;

        Ok(PromptEnhancementResult {
            prompt: envelope
                .data
                .get("caption")
                .and_then(Value::as_str)
                .unwrap_or(request.prompt.as_str())
                .to_owned(),
            lyrics: envelope
                .data
                .get("lyrics")
                .and_then(Value::as_str)
                .map(str::to_owned),
            bpm: envelope.data.get("bpm").and_then(Value::as_i64),
            key_scale: envelope
                .data
                .get("key_scale")
                .and_then(Value::as_str)
                .map(str::to_owned),
            time_signature: envelope
                .data
                .get("time_signature")
                .and_then(Value::as_str)
                .map(str::to_owned),
            duration_seconds: envelope.data.get("duration").and_then(Value::as_f64),
            vocal_language: envelope
                .data
                .get("vocal_language")
                .and_then(Value::as_str)
                .map(str::to_owned),
        })
    }

    pub fn query_result(&self, task_ids: Vec<String>) -> AppResult<Vec<AceTaskResult>> {
        let envelope: AceEnvelope<Vec<Value>> = self.post_envelope(
            "/query_result",
            &json!({ "task_id_list": task_ids }),
            TASK_QUERY_TIMEOUT,
            AppError::task_failed,
        )?;
        Self::ensure_success(&envelope, AppError::task_failed)?;

        envelope
            .data
            .into_iter()
            .map(Self::parse_task_result)
            .collect()
    }

    pub fn download_audio(&self, path: &str) -> AppResult<Vec<u8>> {
        let response = self
            .http
            .get(format!("{}/v1/audio", self.base_url))
            .query(&[("path", path)])
            .timeout(AUDIO_DOWNLOAD_TIMEOUT)
            .send()
            .map_err(|error| AppError::audio_download_failed(error.to_string()))?;

        if !response.status().is_success() {
            return Err(AppError::audio_download_failed(format!(
                "audio endpoint returned status {}",
                response.status()
            )));
        }

        response
            .bytes()
            .map(|bytes| bytes.to_vec())
            .map_err(|error| AppError::audio_download_failed(error.to_string()))
    }

    fn get_envelope<T: DeserializeOwned>(&self, path: &str) -> AppResult<T> {
        self.http
            .get(format!("{}{}", self.base_url, path))
            .timeout(LIST_MODELS_TIMEOUT)
            .send()
            .map_err(|error| AppError::task_submit_failed(error.to_string()))?
            .json::<T>()
            .map_err(|error| AppError::task_submit_failed(error.to_string()))
    }

    fn post_envelope<T: DeserializeOwned>(
        &self,
        path: &str,
        body: &Value,
        timeout: std::time::Duration,
        error: fn(String) -> AppError,
    ) -> AppResult<T> {
        self.http
            .post(format!("{}{}", self.base_url, path))
            .json(body)
            .timeout(timeout)
            .send()
            .map_err(|send_error| error(send_error.to_string()))?
            .json::<T>()
            .map_err(|json_error| error(json_error.to_string()))
    }

    fn ensure_success<T>(
        envelope: &AceEnvelope<T>,
        factory: impl FnOnce(String) -> AppError,
    ) -> AppResult<()> {
        if (envelope.code == 0 || envelope.code == 200) && envelope.error.is_none() {
            return Ok(());
        }

        let timestamp = envelope.timestamp.as_ref().map(timestamp_to_string);
        let details = match (&envelope.error, &timestamp) {
            (Some(error), Some(timestamp)) => format!("{error} at {timestamp}"),
            (Some(error), None) => error.clone(),
            (None, Some(timestamp)) => {
                format!("ACE-Step returned code {} at {timestamp}", envelope.code)
            }
            (None, None) => format!("ACE-Step returned non-zero code {}", envelope.code),
        };

        Err(factory(details))
    }

    fn parse_task_result(item: Value) -> AppResult<AceTaskResult> {
        let task_id = item
            .get("task_id")
            .or_else(|| item.get("id"))
            .and_then(Value::as_str)
            .map(str::to_owned)
            .ok_or_else(|| AppError::task_failed("query_result item is missing task_id"))?;

        let status = item
            .get("status")
            .and_then(Value::as_i64)
            .ok_or_else(|| AppError::task_failed("query_result item is missing numeric status"))?;

        let raw_result = item
            .get("result")
            .and_then(Value::as_str)
            .and_then(|value| serde_json::from_str::<Value>(value).ok());

        let state = match status {
            0 => AceTaskState::Running,
            1 => {
                let result_payload = raw_result.as_ref().and_then(primary_result_payload);
                let file_path = result_payload.and_then(extract_audio_path).ok_or_else(|| {
                    AppError::task_failed(
                        "query_result succeeded but did not include an audio file path",
                    )
                })?;
                AceTaskState::Succeeded { file_path }
            }
            2 => {
                let error_message = item
                    .get("error")
                    .and_then(Value::as_str)
                    .map(str::to_owned)
                    .or_else(|| {
                        raw_result
                            .as_ref()
                            .and_then(|value| value.get("error"))
                            .and_then(Value::as_str)
                            .map(str::to_owned)
                    })
                    .unwrap_or_else(|| "ACE-Step reported task failure.".to_owned());

                AceTaskState::Failed {
                    error: AppError::task_failed(error_message),
                }
            }
            other => {
                return Err(AppError::task_failed(format!(
                    "ACE-Step returned unknown task status {other}"
                )))
            }
        };

        Ok(AceTaskResult {
            task_id,
            state,
            raw_result,
        })
    }
}

fn primary_result_payload(value: &Value) -> Option<&Value> {
    match value {
        Value::Array(items) => items.first(),
        Value::Object(_) => Some(value),
        _ => None,
    }
}

fn extract_audio_path(value: &Value) -> Option<String> {
    let raw_path = value
        .get("file")
        .or_else(|| value.get("path"))
        .or_else(|| value.get("audio_path"))
        .or_else(|| value.get("output_path"))
        .and_then(Value::as_str)?;
    Some(normalize_audio_path(raw_path))
}

fn normalize_audio_path(raw_path: &str) -> String {
    let Some((_, query)) = raw_path.split_once('?') else {
        return raw_path.to_owned();
    };
    for pair in query.split('&') {
        let Some((key, value)) = pair.split_once('=') else {
            continue;
        };
        if key == "path" {
            return percent_decode(value);
        }
    }
    raw_path.to_owned()
}

fn percent_decode(value: &str) -> String {
    let mut output = Vec::with_capacity(value.len());
    let bytes = value.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'%' if index + 2 < bytes.len() => {
                if let (Some(high), Some(low)) =
                    (hex_value(bytes[index + 1]), hex_value(bytes[index + 2]))
                {
                    output.push((high << 4) | low);
                    index += 3;
                    continue;
                }
                output.push(bytes[index]);
                index += 1;
            }
            b'+' => {
                output.push(b' ');
                index += 1;
            }
            byte => {
                output.push(byte);
                index += 1;
            }
        }
    }
    String::from_utf8_lossy(&output).into_owned()
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn timestamp_to_string(value: &Value) -> String {
    value
        .as_str()
        .map(str::to_owned)
        .unwrap_or_else(|| value.to_string())
}

#[cfg(test)]
mod tests {
    use super::{AceClient, AceTaskState};
    use crate::models::generation::GenerationRequest;
    use mockito::Server;

    fn sample_request() -> GenerationRequest {
        GenerationRequest {
            prompt: "warm piano".to_owned(),
            negative_prompt: None,
            lyrics: "".to_owned(),
            vocal_language: "en".to_owned(),
            duration_seconds: 30.0,
            bpm: Some(90),
            key_scale: Some("C Major".to_owned()),
            time_signature: "4".to_owned(),
            audio_format: "wav".to_owned(),
            model: Some("acestep-v15-turbo".to_owned()),
            task_type: "text2music".to_owned(),
            lm_model_path: Some("acestep-5Hz-lm-1.7B".to_owned()),
            lm_backend: Some("pt".to_owned()),
            thinking: true,
            inference_steps: 8,
            guidance_scale: 7.0,
            use_format: false,
            use_cot_caption: true,
            use_cot_language: true,
            constrained_decoding: true,
            reference_audio_path: None,
            src_audio_path: None,
            instruction: None,
            repainting_start: None,
            repainting_end: None,
            audio_cover_strength: None,
            use_random_seed: true,
            seed: None,
            variation_count: 1,
        }
    }

    #[test]
    fn health_passes_when_endpoint_is_healthy() {
        let mut server = Server::new();
        let _mock = server.mock("GET", "/health").with_status(200).create();
        let client = AceClient::from_base_url(server.url()).expect("client should create");

        client.health().expect("health check should pass");
    }

    #[test]
    fn list_models_extracts_names_from_envelope() {
        let mut server = Server::new();
        let _mock = server
            .mock("GET", "/v1/models")
            .with_status(200)
            .with_body(r#"{"data":[{"name":"acestep-v15-turbo"},"acestep-lite"],"code":0,"error":null,"timestamp":"2026-04-23T00:00:00Z"}"#)
            .create();
        let client = AceClient::from_base_url(server.url()).expect("client should create");

        let models = client.list_models().expect("models should parse");
        assert_eq!(models, vec!["acestep-v15-turbo", "acestep-lite"]);
    }

    #[test]
    fn release_task_extracts_task_identifier() {
        let mut server = Server::new();
        let _mock = server
            .mock("POST", "/release_task")
            .with_status(200)
            .with_body(r#"{"data":{"task_id":"task-123"},"code":200,"error":null,"timestamp":1770000000000,"extra":null}"#)
            .create();
        let client = AceClient::from_base_url(server.url()).expect("client should create");

        let released = client
            .release_task(&sample_request())
            .expect("task release should parse");
        assert_eq!(released.task_id, "task-123");
    }

    #[test]
    fn query_result_normalizes_success_status_and_embedded_json() {
        let mut server = Server::new();
        let _mock = server
            .mock("POST", "/query_result")
            .with_status(200)
            .with_body(r#"{"data":[{"task_id":"task-123","status":1,"result":"[{\"file\":\"/v1/audio?path=%2Ftmp%2Fgenerated.flac\"}]"}],"code":0,"error":null,"timestamp":"2026-04-23T00:00:00Z"}"#)
            .create();
        let client = AceClient::from_base_url(server.url()).expect("client should create");

        let results = client
            .query_result(vec!["task-123".to_owned()])
            .expect("query result should parse");

        match &results[0].state {
            AceTaskState::Succeeded { file_path } => assert_eq!(file_path, "/tmp/generated.flac"),
            other => panic!("expected succeeded task state, got {other:?}"),
        }
    }

    #[test]
    fn format_input_parses_enhanced_caption_and_metadata() {
        let mut server = Server::new();
        let _mock = server
            .mock("POST", "/format_input")
            .with_status(200)
            .with_body(r#"{"data":{"caption":"enhanced pop rock","lyrics":"[Verse]\nHello","bpm":120,"key_scale":"C Major","time_signature":"4","duration":180,"vocal_language":"en"},"code":200,"error":null,"timestamp":1770000000000}"#)
            .create();
        let client = AceClient::from_base_url(server.url()).expect("client should create");

        let enhanced = client
            .format_input(&sample_request())
            .expect("format input should parse");

        assert_eq!(enhanced.prompt, "enhanced pop rock");
        assert_eq!(enhanced.lyrics.as_deref(), Some("[Verse]\nHello"));
        assert_eq!(enhanced.bpm, Some(120));
        assert_eq!(enhanced.key_scale.as_deref(), Some("C Major"));
        assert_eq!(enhanced.duration_seconds, Some(180.0));
    }

    #[test]
    fn download_audio_returns_bytes() {
        let mut server = Server::new();
        let _mock = server
            .mock("GET", "/v1/audio")
            .match_query(mockito::Matcher::UrlEncoded(
                "path".into(),
                "generated.wav".into(),
            ))
            .with_status(200)
            .with_body(vec![1, 2, 3, 4])
            .create();
        let client = AceClient::from_base_url(server.url()).expect("client should create");

        let bytes = client
            .download_audio("generated.wav")
            .expect("audio should download");
        assert_eq!(bytes, vec![1, 2, 3, 4]);
    }
}
