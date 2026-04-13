pub const KG_TO_LBS: f64 = 2.20462;

pub fn kg_to_lbs(kg: f64) -> f64 {
    (kg * KG_TO_LBS * 10.0).round() / 10.0
}

pub fn lbs_to_kg(lbs: f64) -> f64 {
    (lbs / KG_TO_LBS * 10.0).round() / 10.0
}
