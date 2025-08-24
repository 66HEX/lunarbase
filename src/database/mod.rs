use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool, PoolError, PooledConnection};
use diesel::sqlite::SqliteConnection;
use std::env;

pub type DatabasePool = Pool<ConnectionManager<SqliteConnection>>;

pub fn create_pool(database_url: &str) -> Result<DatabasePool, PoolError> {
    create_pool_with_size(database_url, 10)
}

pub fn create_pool_with_size(database_url: &str, max_size: u32) -> Result<DatabasePool, PoolError> {
    let manager = ConnectionManager::<SqliteConnection>::new(database_url);
    let pool = Pool::builder()
        .max_size(max_size)
        .connection_customizer(Box::new(SqlCipherCustomizer))
        .build(manager)?;
    Ok(pool)
}

#[derive(Debug)]
struct SqlCipherCustomizer;

impl diesel::r2d2::CustomizeConnection<SqliteConnection, diesel::r2d2::Error>
    for SqlCipherCustomizer
{
    fn on_acquire(&self, conn: &mut SqliteConnection) -> Result<(), diesel::r2d2::Error> {
        if let Ok(key) = env::var("SQLCIPHER_KEY") {
            diesel::sql_query(format!("PRAGMA key='{}'", key))
                .execute(conn)
                .map_err(|e| diesel::r2d2::Error::QueryError(e))?;
        }

        diesel::sql_query("PRAGMA journal_mode=WAL")
            .execute(conn)
            .map_err(|e| diesel::r2d2::Error::QueryError(e))?;

        diesel::sql_query("PRAGMA synchronous=NORMAL")
            .execute(conn)
            .map_err(|e| diesel::r2d2::Error::QueryError(e))?;

        Ok(())
    }
}

pub fn get_connection(
    pool: &DatabasePool,
) -> Result<PooledConnection<ConnectionManager<SqliteConnection>>, PoolError> {
    pool.get()
}
