use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExerciseTemplate {
    pub id: String,
    pub title: String,
    pub exercise_type: String,
    pub primary_muscle_group: String,
    pub secondary_muscle_groups: Vec<String>,
    pub equipment: Option<String>,
    pub is_custom: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HevyExerciseTemplate {
    pub id: String,
    pub title: String,
    #[serde(rename = "type")]
    pub exercise_type: String,
    pub primary_muscle_group: String,
    pub secondary_muscle_groups: Vec<String>,
    pub is_custom: bool,
}
