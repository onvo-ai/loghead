import time
import random
import sys
from datetime import datetime

def log(level, message):
    timestamp = datetime.now().isoformat()
    print(f"[{level}] {timestamp} DockerApp: {message}", flush=True)

def main():
    log("INFO", "Starting worker process...")
    time.sleep(1)
    log("INFO", "Worker initialized. Waiting for tasks.")
    
    tasks = ["ProcessImage", "SendEmail", "UpdateDatabase", "GenerateReport"]
    
    for i in range(10):
        task = random.choice(tasks)
        log("INFO", f"Received task: {task} id={i}")
        time.sleep(0.5)
        
        if random.random() < 0.2:
            print(f"[WARN] {datetime.now().isoformat()} DockerApp: Task {task} took longer than expected", file=sys.stderr, flush=True)
        
        log("INFO", f"Task {task} completed successfully")
        time.sleep(1)

    log("ERROR", "Connection to message queue lost!")
    print(f"[FATAL] {datetime.now().isoformat()} DockerApp: Critical failure in main loop", file=sys.stderr, flush=True)
    sys.exit(1)

if __name__ == "__main__":
    main()
