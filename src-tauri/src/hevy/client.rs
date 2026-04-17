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

#[derive(Debug, Deserialize)]
pub struct RoutineFoldersPage {
    pub page: i32,
    pub page_count: i32,
    pub routine_folders: Vec<RoutineFolderResponse>,
}

#[derive(Debug, Deserialize)]
pub struct RoutinesPage {
    pub page: i32,
    pub page_count: i32,
    pub routines: Vec<RoutineResponse>,
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
    pub updated_at: Option<String>,
    pub created_at: Option<String>,
}

// Wrapper types for API responses that nest the actual data
#[derive(Debug, Deserialize)]
struct RoutineFolderResponseWrapper {
    routine_folder: RoutineFolderResponse,
}

#[derive(Debug, Deserialize)]
struct RoutineResponseWrapper {
    routine: Vec<RoutineResponse>,
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

        let wrapper: RoutineFolderResponseWrapper = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;
        Ok(wrapper.routine_folder)
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

        let body = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read response body: {}", e))?;

        serde_json::from_str::<RoutineResponseWrapper>(&body)
            .ok()
            .and_then(|w| w.routine.into_iter().next())
            .or_else(|| serde_json::from_str::<RoutineResponse>(&body).ok())
            .ok_or_else(|| format!("Failed to parse routine response | body: {}", &body[..body.len().min(500)]))
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

        let body = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read response body: {}", e))?;

        serde_json::from_str::<RoutineResponseWrapper>(&body)
            .ok()
            .and_then(|w| w.routine.into_iter().next())
            .or_else(|| serde_json::from_str::<RoutineResponse>(&body).ok())
            .ok_or_else(|| format!("Failed to parse routine response | body: {}", &body[..body.len().min(500)]))
    }

    pub async fn get_routine_folders(
        &self,
        page: i32,
        page_size: i32,
    ) -> Result<RoutineFoldersPage, String> {
        let resp = self
            .client
            .get(format!("{}/v1/routine_folders", BASE_URL))
            .header("api-key", &self.api_key)
            .query(&[("page", page), ("pageSize", page_size)])
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

    pub async fn get_routines(
        &self,
        page: i32,
        page_size: i32,
    ) -> Result<RoutinesPage, String> {
        let resp = self
            .client
            .get(format!("{}/v1/routines", BASE_URL))
            .header("api-key", &self.api_key)
            .query(&[("page", page), ("pageSize", page_size)])
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

    pub async fn get_all_routine_folders(&self) -> Result<Vec<RoutineFolderResponse>, String> {
        let mut all = Vec::new();
        let mut page = 1;
        loop {
            let resp = self.get_routine_folders(page, 10).await?;
            all.extend(resp.routine_folders);
            if page >= resp.page_count {
                break;
            }
            page += 1;
        }
        Ok(all)
    }

    pub async fn get_routines_by_folder(
        &self,
        folder_id: i64,
    ) -> Result<Vec<RoutineResponse>, String> {
        let mut all = Vec::new();
        let mut page = 1;
        loop {
            let resp = self.get_routines(page, 10).await?;
            for r in resp.routines {
                if r.folder_id == Some(folder_id) {
                    all.push(r);
                }
            }
            if page >= resp.page_count {
                break;
            }
            page += 1;
        }
        Ok(all)
    }
}
