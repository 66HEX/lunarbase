use crate::models::CollectionSchema;
use crate::utils::AuthError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct QueryEngine {
    pub sort: Vec<SortField>,
    pub filters: Vec<FilterCondition>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortField {
    pub field: String,
    pub direction: SortDirection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortDirection {
    Asc,
    Desc,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterCondition {
    pub field: String,
    pub operator: FilterOperator,
    pub value: FilterValue,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FilterOperator {
    Eq,
    Ne,
    Gt,
    Gte,
    Lt,
    Lte,
    Like,
    NotLike,
    In,
    NotIn,
    IsNull,
    IsNotNull,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FilterValue {
    String(String),
    Number(f64),
    Boolean(bool),
    Array(Vec<String>),
    Null,
}

impl QueryEngine {
    pub fn new(
        sort: Option<String>,
        filter: Option<String>,
        search: Option<String>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Self, AuthError> {
        let mut query_engine = QueryEngine {
            sort: Vec::new(),
            filters: Vec::new(),
            search,
            limit,
            offset,
        };

        if let Some(sort_str) = sort {
            query_engine.sort = Self::parse_sort(&sort_str)?;
        }

        if let Some(filter_str) = filter {
            query_engine.filters = Self::parse_filters(&filter_str)?;
        }

        Ok(query_engine)
    }

    fn parse_sort(sort_str: &str) -> Result<Vec<SortField>, AuthError> {
        let mut sort_fields = Vec::new();

        for field_str in sort_str.split(',') {
            let field_str = field_str.trim();
            if field_str.is_empty() {
                continue;
            }

            let (field, direction) = if field_str.starts_with('-') {
                (&field_str[1..], SortDirection::Desc)
            } else {
                (field_str, SortDirection::Asc)
            };

            if !Self::is_valid_field_name(field) {
                return Err(AuthError::ValidationError(vec![format!(
                    "Invalid field name for sorting: {}",
                    field
                )]));
            }

            sort_fields.push(SortField {
                field: field.to_string(),
                direction,
            });
        }

        Ok(sort_fields)
    }

    fn parse_filters(filter_str: &str) -> Result<Vec<FilterCondition>, AuthError> {
        let mut filters = Vec::new();

        for filter_part in filter_str.split(',') {
            let filter_part = filter_part.trim();
            if filter_part.is_empty() {
                continue;
            }

            let parts: Vec<&str> = filter_part.split(':').collect();
            if parts.len() < 2 {
                return Err(AuthError::ValidationError(vec![format!(
                    "Invalid filter format: {}",
                    filter_part
                )]));
            }

            let field = parts[0];
            let operator_str = parts[1];
            let value_str = if parts.len() > 2 {
                parts[2..].join(":")
            } else {
                String::new()
            };

            if !Self::is_valid_field_name(field) {
                return Err(AuthError::ValidationError(vec![format!(
                    "Invalid field name for filtering: {}",
                    field
                )]));
            }

            let operator = Self::parse_operator(operator_str)?;

            let value = Self::parse_filter_value(&value_str, &operator)?;

            filters.push(FilterCondition {
                field: field.to_string(),
                operator,
                value,
            });
        }

        Ok(filters)
    }

    fn parse_operator(op_str: &str) -> Result<FilterOperator, AuthError> {
        match op_str.to_lowercase().as_str() {
            "eq" => Ok(FilterOperator::Eq),
            "ne" => Ok(FilterOperator::Ne),
            "gt" => Ok(FilterOperator::Gt),
            "gte" => Ok(FilterOperator::Gte),
            "lt" => Ok(FilterOperator::Lt),
            "lte" => Ok(FilterOperator::Lte),
            "like" => Ok(FilterOperator::Like),
            "notlike" => Ok(FilterOperator::NotLike),
            "in" => Ok(FilterOperator::In),
            "notin" => Ok(FilterOperator::NotIn),
            "isnull" => Ok(FilterOperator::IsNull),
            "isnotnull" => Ok(FilterOperator::IsNotNull),
            _ => Err(AuthError::ValidationError(vec![format!(
                "Unsupported filter operator: {}",
                op_str
            )])),
        }
    }

    fn parse_filter_value(
        value_str: &str,
        operator: &FilterOperator,
    ) -> Result<FilterValue, AuthError> {
        match operator {
            FilterOperator::IsNull | FilterOperator::IsNotNull => Ok(FilterValue::Null),
            FilterOperator::In | FilterOperator::NotIn => {
                let values: Vec<String> = value_str
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                Ok(FilterValue::Array(values))
            }
            _ => {
                if value_str.is_empty() {
                    return Ok(FilterValue::Null);
                }

                if let Ok(bool_val) = value_str.parse::<bool>() {
                    return Ok(FilterValue::Boolean(bool_val));
                }

                if let Ok(num_val) = value_str.parse::<f64>() {
                    return Ok(FilterValue::Number(num_val));
                }

                Ok(FilterValue::String(value_str.to_string()))
            }
        }
    }

    fn is_valid_field_name(field: &str) -> bool {
        !field.is_empty()
            && field.len() <= 100
            && field
                .chars()
                .all(|c| c.is_alphanumeric() || c == '_' || c == '.')
    }

    pub fn build_order_by_clause(&self, schema: &CollectionSchema) -> Result<String, AuthError> {
        if self.sort.is_empty() {
            return Ok("ORDER BY \"created_at\" DESC".to_string());
        }

        let mut order_parts = Vec::new();

        for sort_field in &self.sort {
            if !self.is_valid_sort_field(&sort_field.field, schema) {
                return Err(AuthError::ValidationError(vec![format!(
                    "Field '{}' does not exist or cannot be sorted",
                    sort_field.field
                )]));
            }

            let direction = match sort_field.direction {
                SortDirection::Asc => "ASC",
                SortDirection::Desc => "DESC",
            };

            let escaped_field = self.escape_field_name(&sort_field.field);
            order_parts.push(format!("{} {}", escaped_field, direction));
        }

        Ok(format!("ORDER BY {}", order_parts.join(", ")))
    }

    pub fn build_where_clause(
        &self,
        schema: &CollectionSchema,
    ) -> Result<(String, Vec<String>), AuthError> {
        let mut where_parts = Vec::new();
        let mut parameters = Vec::new();

        if let Some(search_term) = &self.search {
            if !search_term.trim().is_empty() {
                let mut search_conditions = Vec::new();
                let search_pattern = format!("%{}%", search_term.trim());

                search_conditions.push("\"title\" LIKE ?".to_string());
                parameters.push(search_pattern.clone());

                if schema.fields.iter().any(|f| f.name == "content") {
                    search_conditions.push("\"content\" LIKE ?".to_string());
                    parameters.push(search_pattern.clone());
                }

                for field in &schema.fields {
                    if field.name != "title" && field.name != "content" {
                        match field.field_type {
                            crate::models::FieldType::Text
                            | crate::models::FieldType::Email
                            | crate::models::FieldType::Url => {
                                let escaped_field = self.escape_field_name(&field.name);
                                search_conditions.push(format!("{} LIKE ?", escaped_field));
                                parameters.push(search_pattern.clone());
                            }
                            _ => {}
                        }
                    }
                }

                if !search_conditions.is_empty() {
                    where_parts.push(format!("({})", search_conditions.join(" OR ")));
                }
            }
        }

        for filter in &self.filters {
            if !self.is_valid_filter_field(&filter.field, schema) {
                return Err(AuthError::ValidationError(vec![format!(
                    "Field '{}' does not exist or cannot be filtered",
                    filter.field
                )]));
            }

            let (condition_sql, mut condition_params) = self.build_filter_condition(filter)?;
            where_parts.push(condition_sql);
            parameters.append(&mut condition_params);
        }

        if where_parts.is_empty() {
            return Ok(("".to_string(), vec![]));
        }

        let where_clause = format!("WHERE {}", where_parts.join(" AND "));
        Ok((where_clause, parameters))
    }

    fn build_filter_condition(
        &self,
        filter: &FilterCondition,
    ) -> Result<(String, Vec<String>), AuthError> {
        let escaped_field = self.escape_field_name(&filter.field);

        match &filter.operator {
            FilterOperator::Eq => Ok((
                format!("{} = ?", escaped_field),
                vec![self.filter_value_to_string(&filter.value)],
            )),
            FilterOperator::Ne => Ok((
                format!("{} != ?", escaped_field),
                vec![self.filter_value_to_string(&filter.value)],
            )),
            FilterOperator::Gt => Ok((
                format!("{} > ?", escaped_field),
                vec![self.filter_value_to_string(&filter.value)],
            )),
            FilterOperator::Gte => Ok((
                format!("{} >= ?", escaped_field),
                vec![self.filter_value_to_string(&filter.value)],
            )),
            FilterOperator::Lt => Ok((
                format!("{} < ?", escaped_field),
                vec![self.filter_value_to_string(&filter.value)],
            )),
            FilterOperator::Lte => Ok((
                format!("{} <= ?", escaped_field),
                vec![self.filter_value_to_string(&filter.value)],
            )),
            FilterOperator::Like => {
                let value_str = self.filter_value_to_string(&filter.value);
                let like_value = if value_str.starts_with('%') || value_str.ends_with('%') {
                    value_str
                } else {
                    format!("%{}%", value_str)
                };
                Ok((format!("{} LIKE ?", escaped_field), vec![like_value]))
            }
            FilterOperator::NotLike => {
                let value_str = self.filter_value_to_string(&filter.value);
                let like_value = if value_str.starts_with('%') || value_str.ends_with('%') {
                    value_str
                } else {
                    format!("%{}%", value_str)
                };
                Ok((format!("{} NOT LIKE ?", escaped_field), vec![like_value]))
            }
            FilterOperator::IsNull => Ok((format!("{} IS NULL", escaped_field), vec![])),
            FilterOperator::IsNotNull => Ok((format!("{} IS NOT NULL", escaped_field), vec![])),
            FilterOperator::In => {
                if let FilterValue::Array(values) = &filter.value {
                    let placeholders = vec!["?"; values.len()].join(", ");
                    let params = values.iter().map(|v| v.clone()).collect();
                    Ok((format!("{} IN ({})", escaped_field, placeholders), params))
                } else {
                    Err(AuthError::ValidationError(vec![
                        "IN operator requires array value".to_string(),
                    ]))
                }
            }
            FilterOperator::NotIn => {
                if let FilterValue::Array(values) = &filter.value {
                    let placeholders = vec!["?"; values.len()].join(", ");
                    let params = values.iter().map(|v| v.clone()).collect();
                    Ok((
                        format!("{} NOT IN ({})", escaped_field, placeholders),
                        params,
                    ))
                } else {
                    Err(AuthError::ValidationError(vec![
                        "NOT IN operator requires array value".to_string(),
                    ]))
                }
            }
        }
    }

    fn filter_value_to_string(&self, value: &FilterValue) -> String {
        match value {
            FilterValue::String(s) => s.clone(),
            FilterValue::Number(n) => n.to_string(),
            FilterValue::Boolean(b) => {
                if *b {
                    "1".to_string()
                } else {
                    "0".to_string()
                }
            }
            FilterValue::Null => "NULL".to_string(),
            FilterValue::Array(_) => "".to_string(),
        }
    }

    fn escape_field_name(&self, field: &str) -> String {
        format!("\"{}\"", field.replace("\"", "\"\""))
    }

    fn is_valid_sort_field(&self, field: &str, schema: &CollectionSchema) -> bool {
        if matches!(field, "id" | "created_at" | "updated_at") {
            return true;
        }

        schema.fields.iter().any(|f| f.name == field)
    }

    fn is_valid_filter_field(&self, field: &str, schema: &CollectionSchema) -> bool {
        if matches!(field, "id" | "created_at" | "updated_at") {
            return true;
        }

        schema.fields.iter().any(|f| f.name == field)
    }

    pub fn build_complete_query(
        &self,
        table_name: &str,
        schema: &CollectionSchema,
    ) -> Result<(String, Vec<String>), AuthError> {
        let escaped_table_name = self.escape_field_name(table_name);
        let mut sql = format!("SELECT id FROM {}", escaped_table_name);
        let mut parameters = Vec::new();

        let (where_clause, where_params) = self.build_where_clause(schema)?;
        if !where_clause.is_empty() {
            sql.push(' ');
            sql.push_str(&where_clause);
            parameters.extend(where_params);
        }

        let order_clause = self.build_order_by_clause(schema)?;
        sql.push(' ');
        sql.push_str(&order_clause);

        if let Some(limit) = self.limit {
            sql.push_str(&format!(" LIMIT {}", limit));
        }

        if let Some(offset) = self.offset {
            sql.push_str(&format!(" OFFSET {}", offset));
        }

        Ok((sql, parameters))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CollectionSchema, FieldDefinition, FieldType};

    fn create_test_schema() -> CollectionSchema {
        CollectionSchema {
            fields: vec![
                FieldDefinition {
                    name: "name".to_string(),
                    field_type: FieldType::Text,
                    required: true,
                    default_value: None,
                    validation: None,
                },
                FieldDefinition {
                    name: "age".to_string(),
                    field_type: FieldType::Number,
                    required: false,
                    default_value: None,
                    validation: None,
                },
                FieldDefinition {
                    name: "active".to_string(),
                    field_type: FieldType::Boolean,
                    required: false,
                    default_value: None,
                    validation: None,
                },
            ],
        }
    }

    #[test]
    fn test_parse_sort() {
        let sort_fields = QueryEngine::parse_sort("name,-age,created_at").unwrap();

        assert_eq!(sort_fields.len(), 3);
        assert_eq!(sort_fields[0].field, "name");
        assert!(matches!(sort_fields[0].direction, SortDirection::Asc));
        assert_eq!(sort_fields[1].field, "age");
        assert!(matches!(sort_fields[1].direction, SortDirection::Desc));
        assert_eq!(sort_fields[2].field, "created_at");
        assert!(matches!(sort_fields[2].direction, SortDirection::Asc));
    }

    #[test]
    fn test_parse_filters() {
        let filters = QueryEngine::parse_filters("name:eq:John,age:gt:18,active:eq:true").unwrap();

        assert_eq!(filters.len(), 3);

        assert_eq!(filters[0].field, "name");
        assert!(matches!(filters[0].operator, FilterOperator::Eq));
        assert!(matches!(filters[0].value, FilterValue::String(_)));

        assert_eq!(filters[1].field, "age");
        assert!(matches!(filters[1].operator, FilterOperator::Gt));
        assert!(matches!(filters[1].value, FilterValue::Number(_)));

        assert_eq!(filters[2].field, "active");
        assert!(matches!(filters[2].operator, FilterOperator::Eq));
        assert!(matches!(filters[2].value, FilterValue::Boolean(_)));
    }

    #[test]
    fn test_empty_parameters() {
        let query_engine = QueryEngine::new(None, None, None, None, None).unwrap();

        let schema = create_test_schema();
        let (sql, params) = query_engine
            .build_complete_query("records_products", &schema)
            .unwrap();

        assert!(sql.contains("SELECT id FROM"));
        assert!(sql.contains("ORDER BY"));
        assert_eq!(params.len(), 0);
    }

    #[test]
    fn test_build_complete_query() {
        let query_engine = QueryEngine::new(
            Some("name,-age".to_string()),
            Some("active:eq:true,age:gt:18".to_string()),
            None,
            Some(10),
            Some(5),
        )
        .unwrap();

        let schema = create_test_schema();
        let (sql, params) = query_engine
            .build_complete_query("records_test", &schema)
            .unwrap();

        assert!(sql.contains("WHERE"));
        assert!(sql.contains("ORDER BY"));
        assert!(sql.contains("LIMIT 10"));
        assert!(sql.contains("OFFSET 5"));
        assert_eq!(params.len(), 2);
    }
}
