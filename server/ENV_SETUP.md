# Environment Variables Setup

## Required Environment Variables

สำหรับการถอนเงินอัตโนมัติจากกระเป๋าเดฟ คุณต้องตั้งค่า Environment Variables ดังนี้:

### 1. MongoDB Configuration
```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
```

### 2. TON Treasury Wallet
```bash
# Seed phrase ของกระเป๋าเดฟ (24 คำ)
TREASURY_MNEMONIC=word1 word2 word3 ... word24

# ที่อยู่กระเป๋าเดฟ
DEVELOPER_WALLET=UQBc7kwY1XbqYVQ76dGi+i3J9Ta7BH+j8JfbKJkLWkUgPzp
```

### 3. TON API Configuration
```bash
# API Key จาก @tonapibot (Telegram)
TONCENTER_API_KEY=your_api_key_here

# API Endpoint
TONCENTER_API_URL=https://toncenter.com/api/v2/jsonRPC

# Network (mainnet หรือ testnet)
TON_NETWORK=mainnet
```

### 4. Server Configuration
```bash
# Port ของ server
PORT=3001
```

## วิธีขอ TON API Key

1. เปิด Telegram และค้นหา: `@tonapibot`
2. พิมพ์: `/start`
3. พิมพ์: `/api_key`
4. คัดลอก API Key ที่ได้รับ

## การตั้งค่าบน Vercel

ไปที่ Vercel Dashboard → Settings → Environment Variables และเพิ่ม:

- `MONGODB_URI`
- `TREASURY_MNEMONIC`
- `DEVELOPER_WALLET`
- `TONCENTER_API_KEY`
- `TONCENTER_API_URL`
- `TON_NETWORK`
- `PORT` (optional, Vercel จะตั้งให้เอง)

## การตั้งค่า Local

สร้างไฟล์ `.env` ในโฟลเดอร์ `server/`:

```bash
cp ENV_SETUP.md .env
# แล้วแก้ไขค่าต่างๆ ในไฟล์ .env
```

## ⚠️ คำเตือนความปลอดภัย

- **อย่า commit** ไฟล์ `.env` ลง Git
- **อย่าแชร์** `TREASURY_MNEMONIC` กับใคร
- **ใช้ testnet** สำหรับทดสอบก่อน
- **เก็บ API Key** ไว้เป็นความลับ
