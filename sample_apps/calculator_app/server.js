const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Custom logging format
morgan.token('body', (req) => JSON.stringify(req.body));
app.use(morgan(':method :url :status :res[content-length] - :response-time ms :body'));

console.log("[System] Calculator Service Starting...");
console.log("[System] Environment: " + (process.env.NODE_ENV || "development"));

app.post('/api/calculate', (req, res) => {
    const { a, b, op } = req.body;
    const numA = parseFloat(a);
    const numB = parseFloat(b);

    console.log(`[Worker] Processing calculation: ${numA} ${op} ${numB}`);

    if (isNaN(numA) || isNaN(numB)) {
        console.error("[Error] Invalid input received", { a, b, op });
        return res.status(400).json({ error: "Invalid numbers" });
    }

    let result;
    try {
        switch (op) {
            case '+': result = numA + numB; break;
            case '-': result = numA - numB; break;
            case '*': result = numA * numB; break;
            case '/':
                if (numB === 0) {
                    console.error("[Critical] Division by zero attempted!");
                    throw new Error("Division by zero");
                }
                result = numA / numB;
                break;
            case 'crash':
                console.error("[System] Simulating catastrophic failure...");
                console.error("FATAL ERROR: Memory access violation at 0xDEADBEEF");
                process.exit(1); // Simulate crash
            default:
                console.warn(`[Warning] Unknown operator attempted: ${op}`);
                return res.status(400).json({ error: "Unknown operator" });
        }

        console.log(`[Success] Result: ${result}`);
        res.json({ result });

    } catch (e) {
        console.error(`[Error] Calculation failed: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.listen(port, () => {
    console.log(`[System] Server listening on http://localhost:${port}`);
    console.log(`[System] Ready to accept calculations.`);
});
