#!/usr/bin/env bash
# ================================================================
# NullState — Deploy Script (Termux / Linux)
# Deploy NullState.sol ke Celo Mainnet + auto-verify di Celoscan
#
# PERUBAHAN dari versi sebelumnya:
#   - Tambah --compiler-version di forge verify-contract  ← FIX BUG #3
#   - Buat foundry.toml eksplisit sebelum compile
#   - Cast abi-encode distrip dari prefix 0x sebelum dikirim ke --constructor-args
# ================================================================
set -e

# ---------------------------------------------------------------
# KONFIGURASI — isi sebelum jalankan
# ---------------------------------------------------------------
PRIVATE_KEY=""           # Private key wallet deployer (tanpa 0x)
CELOSCAN_API_KEY=""      # API key dari https://celoscan.io/myapikey
PASSPORT_ORACLE="0x0000000000000000000000000000000000000000"

# Versi solc yang dipakai — harus sama dengan pragma di NullState.sol
SOLC_VERSION="0.8.20"

# ---------------------------------------------------------------
# WARNA
# ---------------------------------------------------------------
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}  NullState — Celo Mainnet Deploy + Verify       ${NC}"
echo -e "${GREEN}=================================================${NC}"

# ---------------------------------------------------------------
# VALIDASI INPUT
# ---------------------------------------------------------------
if [ -z "$PRIVATE_KEY" ]; then
  echo -e "${RED}ERROR: Isi PRIVATE_KEY dulu di dalam script ini!${NC}"
  exit 1
fi
if [ -z "$CELOSCAN_API_KEY" ]; then
  echo -e "${RED}ERROR: Isi CELOSCAN_API_KEY dulu di dalam script ini!${NC}"
  exit 1
fi

# ---------------------------------------------------------------
# CEK & INSTALL DEPENDENSI
# ---------------------------------------------------------------
echo -e "\n${YELLOW}[1/5] Cek dependensi...${NC}"

if ! command -v node &> /dev/null; then
  echo "Node.js tidak ditemukan. Install dulu:"
  echo "  pkg install nodejs (Termux)"
  exit 1
fi

if ! command -v forge &> /dev/null; then
  echo -e "${YELLOW}Forge tidak ditemukan. Install Foundry...${NC}"
  curl -L https://foundry.paradigm.xyz | bash
  export PATH="$HOME/.foundry/bin:$PATH"
  foundryup
fi

echo -e "${GREEN}✓ Dependensi OK${NC}"

# ---------------------------------------------------------------
# SETUP FOUNDRY PROJECT
# ---------------------------------------------------------------
echo -e "\n${YELLOW}[2/5] Setup Foundry project...${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "foundry.toml" ]; then
  forge init --no-git --no-commit . 2>/dev/null || true
  rm -f src/Counter.sol test/Counter.t.sol script/Counter.s.sol 2>/dev/null || true
fi

# ← FIX: Tulis foundry.toml eksplisit dengan versi solc dan optimizer
# Ini memastikan bahwa versi compiler yang dipakai compile == yang didaftarkan ke Celoscan
cat > foundry.toml << EOF
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "${SOLC_VERSION}"
optimizer = true
optimizer_runs = 200
EOF

mkdir -p src
cp contracts/NullState.sol src/NullState.sol

echo -e "${GREEN}✓ Foundry project siap (solc=${SOLC_VERSION}, optimizer=true, runs=200)${NC}"

# ---------------------------------------------------------------
# COMPILE
# ---------------------------------------------------------------
echo -e "\n${YELLOW}[3/5] Compile contract...${NC}"
forge build
echo -e "${GREEN}✓ Compile berhasil${NC}"

# ---------------------------------------------------------------
# DEPLOY
# ---------------------------------------------------------------
echo -e "\n${YELLOW}[4/5] Deploy ke Celo Mainnet...${NC}"

DEPLOY_OUTPUT=$(forge create \
  src/NullState.sol:NullState \
  --rpc-url https://forno.celo.org \
  --private-key "$PRIVATE_KEY" \
  --constructor-args "$PASSPORT_ORACLE" \
  --broadcast 2>&1)

echo "$DEPLOY_OUTPUT"

CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP 'Deployed to: \K0x[a-fA-F0-9]{40}')
TX_HASH=$(echo "$DEPLOY_OUTPUT" | grep -oP 'Transaction hash: \K0x[a-fA-F0-9]{64}')

if [ -z "$CONTRACT_ADDRESS" ]; then
  echo -e "${RED}GAGAL: Tidak bisa parse contract address dari output deploy.${NC}"
  exit 1
fi

echo -e "\n${GREEN}✓ Contract berhasil di-deploy!${NC}"
echo -e "  Address  : ${GREEN}$CONTRACT_ADDRESS${NC}"
echo -e "  TX Hash  : $TX_HASH"
echo -e "  Explorer : https://celoscan.io/address/$CONTRACT_ADDRESS"

# ---------------------------------------------------------------
# VERIFY DI CELOSCAN
# ---------------------------------------------------------------
echo -e "\n${YELLOW}[5/5] Verify contract di Celoscan...${NC}"
echo "Tunggu 30 detik agar TX dikonfirmasi dulu..."
sleep 30

# ← FIX: Encode constructor args, strip 0x prefix sebelum dikirim
RAW_ARGS=$(cast abi-encode "constructor(address)" "$PASSPORT_ORACLE")
CONSTRUCTOR_ARGS="${RAW_ARGS#0x}"   # buang prefix 0x jika ada

forge verify-contract \
  "$CONTRACT_ADDRESS" \
  src/NullState.sol:NullState \
  --chain-id 42220 \
  --etherscan-api-key "$CELOSCAN_API_KEY" \
  --verifier etherscan \
  --verifier-url https://api.celoscan.io/api \
  --compiler-version "${SOLC_VERSION}+commit.a1b79de6" \
  --optimizer-runs 200 \
  --constructor-args "$CONSTRUCTOR_ARGS" \
  --watch

echo -e "\n${GREEN}=================================================${NC}"
echo -e "${GREEN}  SELESAI!${NC}"
echo -e "${GREEN}=================================================${NC}"
echo -e "  Contract : $CONTRACT_ADDRESS"
echo -e "  Celoscan : https://celoscan.io/address/$CONTRACT_ADDRESS#code"
echo ""
echo -e "${YELLOW}LANGKAH SELANJUTNYA:${NC}"
echo -e "  1. Update NULLSTATE_ADDRESS di lib/WalletProvider.tsx"
echo -e "     dengan address: $CONTRACT_ADDRESS"
echo -e "  2. Redeploy frontend ke Vercel"
echo ""
