import { CreateEmailOptions, Resend } from "resend";
import { InvestmentSummary, ResendEmail } from "../types";
import path from "path";
import { promises as fs } from "fs";

async function readTemplateFile(email_path: string) {
  const templatePath = path.join(__dirname, email_path);
  return await fs.readFile(templatePath, "utf-8");
}

export async function sendEmail(email: ResendEmail) {
  const resendEnabled = process.env.RESEND_ENABLE === "true";
  if (!resendEnabled) {
    console.log("Resend is disabled");
    return;
  }
  
  console.log("Sending email...");
  const resend = new Resend(process.env.RESEND_API_KEY as string);

  const { data, error } = await resend.emails.send(email as CreateEmailOptions);
  if (error) {
    console.log(error);
  }
  console.log(`Email sent - id: `, data?.id);
}

export const generateInvestmentSummaryEmail = async (
  investments: InvestmentSummary[],
  total_value: number,
  value_since_last: number
) => {
  try {
    let template = await readTemplateFile(
      "../../public/investmentSummaryTemplate.html"
    );

    const rows = investments
      .map(
        (inv) => `
            <div class="card ${inv.rebalance ? "rebalance" : "no-rebalance"}">
              <div class="card-content">
                <div class="underline">  
                  <h2>${inv.equity_type}</h2>
                </div>
                <p>Markedsverdi: <strong>${inv.market_value.toFixed(
                  2
                )}</strong></p>
                <p>Nåværende allokering: <strong>${
                  inv.current_share
                }%</strong></p>
                <p>Ønsket allokering: <strong>${inv.wanted_share}%</strong></p>
                <p>Nåværende differanse: <strong>${inv.difference}%</strong></p>
                <p>Maksimum differanse: <strong>${
                  inv.max_diff_to_rebalance
                }%</strong></p>
                <p>Å handle for: <strong>${inv.to_trade.toFixed(2)}</strong></p>
              </div>
            </div>
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
