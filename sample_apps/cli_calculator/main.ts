
async function main() {
    console.log(`[INFO] ${new Date().toISOString()} CalculatorService: Starting server on port 3000...`);
    await new Promise(r => setTimeout(r, 200));
    console.log(`[INFO] ${new Date().toISOString()} CalculatorService: Connected to database.`);
    await new Promise(r => setTimeout(r, 300));

    const ops = ["ADD", "SUB", "MUL"];
    for (let i = 0; i < 5; i++) {
        const op = ops[Math.floor(Math.random() * ops.length)];
        const a = Math.floor(Math.random() * 100);
        const b = Math.floor(Math.random() * 100);
        console.log(`[INFO] ${new Date().toISOString()} CalculatorService: Request ${op} a=${a} b=${b}`);
        await new Promise(r => setTimeout(r, 100));
        console.log(`[INFO] ${new Date().toISOString()} CalculatorService: Response 200 OK`);
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[INFO] ${new Date().toISOString()} CalculatorService: Request DIV a=50 b=0`);
    await new Promise(r => setTimeout(r, 100));
    console.error(`[ERROR] ${new Date().toISOString()} CalculatorService: Uncaught Exception: ZeroDivisionError: division by zero`);
    console.error(`    at Calculator.divide (/app/src/calculator.ts:42:15)`);
    console.error(`    at RequestHandler.handle (/app/src/handler.ts:15:22)`);
    console.error(`[FATAL] ${new Date().toISOString()} CalculatorService: Process crashing due to unhandled exception.`);
}

main();
