import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { sepolia } from "@reown/appkit/networks";

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID!;

const metadata = {
  name:        "OTTER Protocol",
  description: "ERC-OTTER Progressive Community Token Standard — Hold Together, Build Together",
  url:         process.env.NEXT_PUBLIC_APP_URL || "https://otterprotocol.xyz",
  icons:       ["https://otterprotocol.xyz/icon.png"],
};

export const appKit = createAppKit({
  adapters:  [new EthersAdapter()],
  networks:  [sepolia],
  metadata,
  projectId,
  features: {
    analytics: true,
    email:     false,
    socials:   false,
  },
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent":                "#C9A84C",
    "--w3m-border-radius-master":  "4px",
    "--w3m-font-family":           "inherit",
    "--w3m-color-mix":             "#000000",
    "--w3m-color-mix-strength":    15,
  },
});

export { sepolia };
