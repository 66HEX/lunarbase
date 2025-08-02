use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool, PoolError, PooledConnection};
use diesel::sqlite::SqliteConnection;
use std::env;

pub type DatabasePool = Pool<ConnectionManager<SqliteConnection>>;

pub fn create_pool(database_url: &str) -> Result<DatabasePool, PoolError> {
    let manager = ConnectionManager::<SqliteConnection>::new(database_url);
    let pool = Pool::builder()
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
        // Set SQLCipher encryption key if SQLCIPHER_KEY environment variable is set
        if let Ok(key) = env::var("SQLCIPHER_KEY") {
            diesel::sql_query(format!("PRAGMA key='{}'", key))
                .execute(conn)
                .map_err(|e| diesel::r2d2::Error::QueryError(e))?;
        }
        Ok(())
    }
}

pub fn get_connection(
    pool: &DatabasePool,
) -> Result<PooledConnection<ConnectionManager<SqliteConnection>>, PoolError> {
    pool.get()
}
