websocket: $ wscat -c ws://localhost:3000/api/ws

biome: $ npx @biomejs/biome check --write

test: cargo test -- --test-threads=1

collection subscription:

{"type":"Subscribe","data":{"subscription_id":"test-sub-1","collection_name":"users","subscription_type":"Collection"}}
