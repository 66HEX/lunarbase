use diesel::sqlite::SqliteConnection;
use diesel::r2d2::{ConnectionManager, Pool, PoolError, PooledConnection};

pub type DatabasePool = Pool<ConnectionManager<SqliteConnection>>;

pub fn create_pool(database_url: &str) -> Result<DatabasePool, PoolError> {
    let manager = ConnectionManager::<SqliteConnection>::new(database_url);
    Pool::builder().build(manager)
}

pub fn get_connection(pool: &DatabasePool) -> Result<PooledConnection<ConnectionManager<SqliteConnection>>, PoolError> {
    pool.get()
} 