import { CreateEmailOptions, Resend } from "resend";
import { ResendEmail } from "../types";
import path from "path";
import { promises as fs } from "fs";

async function readTemplateFile(email_path: string){
    const templatePath = path.join(__dirname, email_path);
    return await fs.readFile(templatePath, "utf-8");
}

export async function sendEmail(email: ResendEmail) {
    console.log("Sending email...");
    const resend = new Resend(process.env.RESEND_API_KEY as string);
  
    const { data, error } = await resend.emails.send(email as CreateEmailOptions);
    if (error) {
      console.log(error);
    }
    console.log(`Email sent - id: `, data?.id);
}

  export const generateInvestmentSummaryEmail = async (
    investments: any[],
    total_value: number,
    value_since_last: number
  ) => {
    try {
      let template = await readTemplateFile('../../public/investmentSummaryTemplate.html')
      
      const rows = investments
        .map(
          (inv) => `
            <tr class="${inv.rebalance ? "rebalance" : "no-rebalance"}">
                <td>${inv.equity_type}</td>
                <td>${inv.market_value.toFixed(2)}</td>
                <td>${inv.current_share}%</td>
                <td>${inv.wanted_share}%</td>
                <td>${inv.difference}%</td>
                <td>${inv.max_diff_to_rebalance}%</td>
                <td>${inv.rebalance ? "Ja" : "Nei"}</td>
                <td>${inv.to_trade.toFixed(2)}</td>
            </tr>
        `
        )
        .join("");
  
      template = template
        .replace("{{rows}}", rows)
        .replace(
          "{{totalValue}}",
          total_value.toLocaleString("nb-NO", {
            style: "currency",
            currency: "NOK",
          })
        )
        .replace("{{name}}", "Stein Petter")
        .replace(
          "{{furthest}}",
          investments.sort((a, b) => b.difference - a.difference)[0].equity_type
        )
        .replace(
          "{{sinceLast}}",
          value_since_last.toLocaleString("nb-NO", {
            style: "currency",
            currency: "NOK",
          })
        );
  
      return template;
    } catch (error) {
      console.error("Feil ved lesing av e-postmal:", error);
      return "";
    }
  };