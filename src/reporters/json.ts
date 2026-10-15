import fs from "fs";
import path from "path";

export class JsonReporter {
    static generate(reportData: any, outputPath: string): void {
        const absolutePath = path.resolve(outputPath);

        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(
            absolutePath,
            JSON.stringify(reportData, null, 2),
            "utf-8",
        );
    }
}
