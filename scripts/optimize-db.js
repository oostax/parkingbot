const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting database optimization...');

const dbPath = path.resolve(process.cwd(), 'pb', 'bot_database.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Database file not found at ${dbPath}`);
  process.exit(1);
}

// Get database size before optimization
const sizeBeforeBytes = fs.statSync(dbPath).size;
const sizeBefore = (sizeBeforeBytes / (1024 * 1024)).toFixed(2);
console.log(`Current database size: ${sizeBefore} MB`);

// Create Python script for optimization
const optimizeScript = path.resolve(process.cwd(), 'pb', 'optimize_db.py');

fs.writeFileSync(optimizeScript, `
import sqlite3
import os
import sys
from datetime import datetime, timedelta

print("Database Optimization Tool")

db_path = os.path.join(os.path.dirname(__file__), 'bot_database.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

def get_table_count(table_name):
    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    return cursor.fetchone()[0]

def get_table_size(table_name):
    cursor.execute(f"SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size() WHERE name=?", (table_name,))
    try:
        return cursor.fetchone()[0]
    except:
        return "Unknown"

# Display table statistics before optimization
print("\\nTable statistics before optimization:")
tables = ["parking_stats", "daily_stats", "forecasts", "favorites"]
for table in tables:
    count = get_table_count(table)
    print(f" - {table}: {count} rows")

# Cleanup old records from parking_stats
print("\\nCleaning up old parking_stats data...")
retention_period = datetime.now() - timedelta(days=30)
cursor.execute("DELETE FROM parking_stats WHERE timestamp < ?", (retention_period,))
deleted_parking_stats = cursor.rowcount
print(f" - Deleted {deleted_parking_stats} old records from parking_stats")

# Cleanup forecasts
print("\\nCleaning up forecasts...")
now = datetime.now()

# 1. Delete past forecasts
cursor.execute("DELETE FROM forecasts WHERE timestamp < ?", (now,))
past_forecasts_deleted = cursor.rowcount
print(f" - Deleted {past_forecasts_deleted} past forecasts")

# 2. Delete far future forecasts (beyond 3 days)
max_forecast_date = now + timedelta(days=3)
cursor.execute("DELETE FROM forecasts WHERE timestamp > ?", (max_forecast_date,))
far_future_deleted = cursor.rowcount
print(f" - Deleted {far_future_deleted} far future forecasts")

# 3. For forecasts beyond tomorrow, keep only key hours (8, 12, 16, 20)
tomorrow = datetime(now.year, now.month, now.day) + timedelta(days=1)
cursor.execute("""
    SELECT COUNT(*) FROM forecasts 
    WHERE timestamp >= ? 
    AND cast(strftime('%H', timestamp) as integer) NOT IN (8, 12, 16, 20)
    AND date(timestamp) > date(?)
""", (tomorrow, tomorrow))
non_key_hours_count = cursor.fetchone()[0]

if non_key_hours_count > 0:
    print(f" - Found {non_key_hours_count} non-key hour forecasts to delete")
    
    cursor.execute("""
        DELETE FROM forecasts 
        WHERE timestamp >= ? 
        AND cast(strftime('%H', timestamp) as integer) NOT IN (8, 12, 16, 20)
        AND date(timestamp) > date(?)
    """, (tomorrow, tomorrow))
    
    print(f" - Deleted {cursor.rowcount} non-key hour forecasts")

conn.commit()

# Run VACUUM to reclaim space
print("\\nRunning VACUUM to reclaim space and defragment database...")
cursor.execute("VACUUM")

# Run PRAGMA optimize to optimize the database
print("Running PRAGMA optimize...")
cursor.execute("PRAGMA optimize")

# Display table statistics after optimization
print("\\nTable statistics after optimization:")
for table in tables:
    count = get_table_count(table)
    print(f" - {table}: {count} rows")

conn.close()
print("\\nOptimization complete!")
`);

// Execute the optimization script
exec(`python3 ${optimizeScript}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error during optimization: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`stderr: ${stderr}`);
  }
  
  console.log(stdout);
  
  // Get database size after optimization
  const sizeAfterBytes = fs.statSync(dbPath).size;
  const sizeAfter = (sizeAfterBytes / (1024 * 1024)).toFixed(2);
  const saved = (sizeBeforeBytes - sizeAfterBytes) / (1024 * 1024);
  const percentSaved = (saved * 100 / (sizeBeforeBytes / (1024 * 1024))).toFixed(2);
  
  console.log(`Database size after optimization: ${sizeAfter} MB`);
  console.log(`Space saved: ${saved.toFixed(2)} MB (${percentSaved}%)`);
}); 