use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Program {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Block {
    pub id: String,
    pub program_id: String,
    pub name: String,
    pub sort_order: i32,
    pub mesocycles: Vec<Mesocycle>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Mesocycle {
    pub id: String,
    pub block_id: String,
    pub name: String,
    pub week_number: i32,
    pub sort_order: i32,
    pub microcycles: Vec<Microcycle>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Microcycle {
    pub id: String,
    pub mesocycle_id: String,
    pub name: String,
    pub day_number: i32,
    pub notes: Option<String>,
    pub sort_order: i32,
    pub exercises: Vec<ProgramExercise>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgramExercise {
    pub id: String,
    pub microcycle_id: String,
    pub exercise_template_id: String,
    pub exercise_title: String,
    pub sort_order: i32,
    pub superset_group: Option<i32>,
    pub rest_seconds: Option<i32>,
    pub notes: Option<String>,
    pub sets: Vec<ProgramSet>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgramSet {
    pub id: String,
    pub program_exercise_id: String,
    pub sort_order: i32,
    pub set_type: String,
    pub reps: Option<i32>,
    pub rep_range_start: Option<i32>,
    pub rep_range_end: Option<i32>,
    pub weight_kg: Option<f64>,
    pub percentage_of_tm: Option<f64>,
    pub rpe_target: Option<f64>,
    pub duration_seconds: Option<i32>,
    pub distance_meters: Option<i32>,
    pub custom_metric: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgramFull {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub blocks: Vec<Block>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrainingMax {
    pub id: String,
    pub exercise_template_id: String,
    pub program_id: String,
    pub estimated_1rm_kg: Option<f64>,
    pub training_max_kg: f64,
    pub tm_percentage_of_1rm: f64,
    pub source: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GlobalTrainingMax {
    pub id: String,
    pub exercise_template_id: String,
    pub estimated_1rm_kg: Option<f64>,
    pub training_max_kg: f64,
    pub tm_percentage_of_1rm: f64,
    pub source: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProgramExerciseInput {
    pub exercise_template_id: String,
    pub sort_order: i32,
    pub superset_group: Option<i32>,
    pub rest_seconds: Option<i32>,
    pub notes: Option<String>,
    pub sets: Vec<ProgramSetInput>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProgramSetInput {
    pub sort_order: i32,
    pub set_type: String,
    pub reps: Option<i32>,
    pub rep_range_start: Option<i32>,
    pub rep_range_end: Option<i32>,
    pub weight_kg: Option<f64>,
    pub percentage_of_tm: Option<f64>,
    pub rpe_target: Option<f64>,
    pub duration_seconds: Option<i32>,
    pub distance_meters: Option<i32>,
    pub custom_metric: Option<f64>,
}
