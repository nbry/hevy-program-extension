use serde::{Deserialize, Serialize};

const BASE_URL: &str = "https://api.hevyapp.com";

pub struct HevyClient {
    api_key: String,
    client: reqwest::Client,
}

#[derive(Debug, Deserialize)]
pub struct UserInfoResponse {
    pub data: UserInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub name: String,
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct ExerciseTemplatesResponse {
    pub page: i32,
    pub page_count: i32,
    pub exercise_templates: Vec<HevyExerciseTemplate>,
}

#[derive(Debug, Deserialize)]
pub struct HevyExerciseTemplate {
    pub id: String,
    pub title: String,
    #[serde(rename = "type")]
    pub exercise_type: String,
    pub primary_muscle_group: String,
    pub secondary_muscle_groups: Vec<String>,
    pub is_custom: bool,
}

#[derive(Debug, Deserialize)]
pub struct RoutineFolderResponse {
    pub id: i64,
    pub index: i64,
    pub title: String,
    pub updated_at: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct CreateRoutineFolderRequest {
    pub routine_folder: CreateRoutineFolderBody,
}

#[derive(Debug, Serialize)]
pub struct CreateRoutineFolderBody {
    pub title: String,
}

#[derive(Debug, Serialize)]
pub struct CreateRoutineRequest {
    pub routine: CreateRoutineBody,
}

#[derive(Debug, Serialize)]
pub struct CreateRoutineBody {
    pub title: String,
    pub folder_id: Option<i64>,
    pub notes: Option<String>,
    pub exercises: Vec<RoutineExercise>,
}

#[derive(Debug, Serialize)]
pub struct RoutineExercise {
    pub exercise_template_id: String,
    pub superset_id: Option<i32>,
    pub rest_seconds: Option<i32>,
    pub notes: Option<String>,
    pub sets: Vec<RoutineSet>,
}

#[derive(Debug, Serialize)]
pub struct RoutineSet {
    #[serde(rename = "type")]
    pub set_type: String,
    pub weight_kg: Option<f64>,
    pub reps: Option<i32>,
    pub rep_range: Option<RepRange>,
    pub distance_meters: Option<i32>,
    pub duration_seconds: Option<i32>,
    pub custom_metric: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct RepRange {
    pub start: i32,
    pub end: i32,
}

#[derive(Debug, Deserialize)]
pub struct RoutineResponse {
    pub id: String,
    pub title: String,
    pub folder_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct ExerciseHistoryResponse {
    pub exercise_history: Vec<ExerciseHistoryEntry>,
}

#[derive(Debug, Deserialize)]
pub struct ExerciseHistoryEntry {
    pub weight_kg: Option<f64>,
    pub reps: Option<i32>,
    pub set_type: String,
}

impl HevyClient {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: reqwest::Client::new(),
        }
    }

    pub async fn validate_key(&self) -> Result<UserInfo, String> {
        let resp = self
            .client
            .get(format!("{}/v1/user/info", BASE_URL))
            .header("api-key", &self.api_key)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("API returned status {}", resp.status()));
        }

        let body: UserInfoResponse = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        Ok(body.data)
    }

    pub async fn get_exercise_templates(
        &self,
        page: i32,
        page_size: i32,
    ) -> Result<ExerciseTemplatesResponse, String> {
        let resp = self
            .client
            .get(format!("{}/v1/exercise_templates", BASE_URL))
            .header("api-key", &self.api_key)
            .query(&[("page", page), ("pageSize", page_size)])
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("API returned status {}", resp.status()));
        }

        resp.json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    pub async fn get_exercise_history(
        &self,
        exercise_template_id: &str,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<ExerciseHistoryEntry>, String> {
        let mut req = self
            .client
            .get(format!(
                "{}/v1/exercise_history/{}",
                BASE_URL, exercise_template_id
            ))
            .header("api-key", &self.api_key);

        if let Some(start) = start_date {
            req = req.query(&[("start_date", start)]);
        }
        if let Some(end) = end_date {
            req = req.query(&[("end_date", end)]);
        }

        let resp = req
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("API returned status {}", resp.status()));
        }

        let body: ExerciseHistoryResponse = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        Ok(body.exercise_history)
    }

    pub async fn create_routine_folder(
        &self,
        title: &str,
    ) -> Result<RoutineFolderResponse, String> {
        let resp = self
            .client
            .post(format!("{}/v1/routine_folders", BASE_URL))
            .header("api-key", &self.api_key)
            .json(&CreateRoutineFolderRequest {
                routine_folder: CreateRoutineFolderBody {
                    title: title.to_string(),
                },
            })
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("API returned status {}: {}", status, body));
        }

        resp.json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    pub async fn create_routine(
        &self,
        routine: CreateRoutineBody,
    ) -> Result<RoutineResponse, String> {
        let resp = self
            .client
            .post(format!("{}/v1/routines", BASE_URL))
            .header("api-key", &self.api_key)
            .json(&CreateRoutineRequest { routine })
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("API returned status {}: {}", status, body));
        }

        resp.json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    pub async fn update_routine(
        &self,
        routine_id: &str,
        routine: CreateRoutineBody,
    ) -> Result<RoutineResponse, String> {
        let resp = self
            .client
            .put(format!("{}/v1/routines/{}", BASE_URL, routine_id))
            .header("api-key", &self.api_key)
            .json(&serde_json::json!({
                "routine": {
                    "title": routine.title,
                    "notes": routine.notes,
                    "exercises": routine.exercises,
                }
            }))
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("API returned status {}: {}", status, body));
        }

        resp.json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }
}
