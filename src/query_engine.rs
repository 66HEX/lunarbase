use crate::models::CollectionSchema;
use crate::utils::AuthError;
use serde::{Deserialize, Serialize};

/// Query parser for handling filtering, sorting and search operations
#[derive(Debug, Clone)]
pub struct QueryEngine {
    pub sort: Vec<SortField>,
    pub filters: Vec<FilterCondition>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Represents a sort field with direction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortField {
    pub field: String,
    pub direction: SortDirection,
}

/// Sort direction enum
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortDirection {
    Asc,
    Desc,
}

/// Filter condition for querying records
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterCondition {
    pub field: String,
    pub operator: FilterOperator,
    pub value: FilterValue,
}

/// Supported filter operators
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FilterOperator {
    Eq,        // Equal
    Ne,        // Not equal
    Gt,        // Greater than
    Gte,       // Greater than or equal
    Lt,        // Less than
    Lte,       // Less than or equal
    Like,      // SQL LIKE pattern
    NotLike,   // SQL NOT LIKE pattern
    In,        // In array of values
    NotIn,     // Not in array of values
    IsNull,    // IS NULL
    IsNotNull, // IS NOT NULL
}

/// Filter value types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FilterValue {
    String(String),
    Number(f64),
    Boolean(bool),
    Array(Vec<String>),
    Null,
}

impl QueryEngine {
    /// Create a new QueryEngine from query parameters
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

        // Parse sort parameter
        if let Some(sort_str) = sort {
            query_engine.sort = Self::parse_sort(&sort_str)?;
        }

        // Parse filter parameter
        if let Some(filter_str) = filter {
            query_engine.filters = Self::parse_filters(&filter_str)?;
        }

        Ok(query_engine)
    }

    /// Parse sort string format: "field1,-field2,field3" (- prefix for DESC)
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

            // Validate field name (alphanumeric and underscore only)
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

    /// Parse filter string format: "field1:eq:value1,field2:gt:123,field3:like:pattern"
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

            // Validate field name
            if !Self::is_valid_field_name(field) {
                return Err(AuthError::ValidationError(vec![format!(
                    "Invalid field name for filtering: {}",
                    field
                )]));
            }

            // Parse operator
            let operator = Self::parse_operator(operator_str)?;

            // Parse value based on operator
            let value = Self::parse_filter_value(&value_str, &operator)?;

            filters.push(FilterCondition {
                field: field.to_string(),
                operator,
                value,
            });
        }

        Ok(filters)
    }

    /// Parse filter operator from string
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

    /// Parse filter value based on operator
    fn parse_filter_value(
        value_str: &str,
        operator: &FilterOperator,
    ) -> Result<FilterValue, AuthError> {
        match operator {
            FilterOperator::IsNull | FilterOperator::IsNotNull => Ok(FilterValue::Null),
            FilterOperator::In | FilterOperator::NotIn => {
                // Parse comma-separated array: "value1,value2,value3"
                let values: Vec<String> = value_str
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                Ok(FilterValue::Array(values))
            }
            _ => {
                // Try to parse as different types
                if value_str.is_empty() {
                    return Ok(FilterValue::Null);
                }

                // Try boolean first
                if let Ok(bool_val) = value_str.parse::<bool>() {
                    return Ok(FilterValue::Boolean(bool_val));
                }

                // Try number
                if let Ok(num_val) = value_str.parse::<f64>() {
                    return Ok(FilterValue::Number(num_val));
                }

                // Default to string
                Ok(FilterValue::String(value_str.to_string()))
            }
        }
    }

    /// Validate field name (alphanumeric, underscore, dots for nested fields)
    fn is_valid_field_name(field: &str) -> bool {
        !field.is_empty()
            && field.len() <= 100
            && field
                .chars()
                .all(|c| c.is_alphanumeric() || c == '_' || c == '.')
    }

    /// Build SQL ORDER BY clause from sort fields
    pub fn build_order_by_clause(&self, schema: &CollectionSchema) -> Result<String, AuthError> {
        if self.sort.is_empty() {
            return Ok("ORDER BY \"created_at\" DESC".to_string());
        }

        let mut order_parts = Vec::new();

        for sort_field in &self.sort {
            // Validate field exists in schema (or is a system field)
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

            // Escape field name to prevent SQL injection
            let escaped_field = self.escape_field_name(&sort_field.field);
            order_parts.push(format!("{} {}", escaped_field, direction));
        }

        Ok(format!("ORDER BY {}", order_parts.join(", ")))
    }

    /// Build SQL WHERE clause from filter conditions
    pub fn build_where_clause(
        &self,
        schema: &CollectionSchema,
    ) -> Result<(String, Vec<String>), AuthError> {
        if self.filters.is_empty() {
            return Ok(("".to_string(), vec![]));
        }

        let mut where_parts = Vec::new();
        let mut parameters = Vec::new();

        for filter in &self.filters {
            // Validate field exists in schema (or is a system field)
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

        let where_clause = format!("WHERE {}", where_parts.join(" AND "));
        Ok((where_clause, parameters))
    }

    /// Build individual filter condition
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
                // Automatically add wildcards for partial matching if not already present
                let like_value = if value_str.starts_with('%') || value_str.ends_with('%') {
                    value_str
                } else {
                    format!("%{}%", value_str)
                };
                Ok((format!("{} LIKE ?", escaped_field), vec![like_value]))
            }
            FilterOperator::NotLike => {
                let value_str = self.filter_value_to_string(&filter.value);
                // Automatically add wildcards for partial matching if not already present
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

    /// Convert filter value to string for SQL parameter
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
            FilterValue::Array(_) => "".to_string(), // Should not be called for arrays
        }
    }

    /// Escape field name to prevent SQL injection
    fn escape_field_name(&self, field: &str) -> String {
        // Use double quotes for SQLite identifiers
        format!("\"{}\"", field.replace("\"", "\"\""))
    }

    /// Check if field can be used for sorting
    fn is_valid_sort_field(&self, field: &str, schema: &CollectionSchema) -> bool {
        // Allow system fields
        if matches!(field, "id" | "created_at" | "updated_at") {
            return true;
        }

        // Check if field exists in schema
        schema.fields.iter().any(|f| f.name == field)
    }

    /// Check if field can be used for filtering
    fn is_valid_filter_field(&self, field: &str, schema: &CollectionSchema) -> bool {
        // Allow system fields
        if matches!(field, "id" | "created_at" | "updated_at") {
            return true;
        }

        // Check if field exists in schema
        schema.fields.iter().any(|f| f.name == field)
    }

    /// Build complete SQL query with WHERE, ORDER BY, LIMIT, OFFSET
    pub fn build_complete_query(
        &self,
        table_name: &str,
        schema: &CollectionSchema,
    ) -> Result<(String, Vec<String>), AuthError> {
        let escaped_table_name = self.escape_field_name(table_name);
        let mut sql = format!("SELECT id FROM {}", escaped_table_name);
        let mut parameters = Vec::new();

        // Add WHERE clause
        let (where_clause, where_params) = self.build_where_clause(schema)?;
        if !where_clause.is_empty() {
            sql.push(' ');
            sql.push_str(&where_clause);
            parameters.extend(where_params);
        }

        // Add ORDER BY clause
        let order_clause = self.build_order_by_clause(schema)?;
        sql.push(' ');
        sql.push_str(&order_clause);

        // Add LIMIT clause
        if let Some(limit) = self.limit {
            sql.push_str(&format!(" LIMIT {}", limit));
        }

        // Add OFFSET clause
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
        let query_engine = QueryEngine::new(
            None, // no sort
            None, // no filter
            None, // no search
            None, // no limit
            None, // no offset
        )
        .unwrap();

        let schema = create_test_schema();
        let (sql, params) = query_engine
            .build_complete_query("records_products", &schema)
            .unwrap();

        println!("Generated SQL: {}", sql);
        println!("Parameters: {:?}", params);

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
        assert_eq!(params.len(), 2); // Two filter values
    }
}
