# 📋 Checklist การ Deploy ระบบถอนเงินอัตโนมัติ

## ✅ สิ่งที่ทำเสร็จแล้ว

- ✅ ติดตั้ง TON SDK packages (`@ton/ton`, `@ton/crypto`, `tonweb`)
- ✅ สร้าง TON Wallet Service (`server/services/tonWallet.js`)
- ✅ อัปเดต API `/api/withdraw` ให้ส่งเงินจริง
- ✅ เพิ่ม Socket notification เมื่อถอนเงินสำเร็จ
- ✅ เพิ่ม Error handling และ Logging
- ✅ สร้างเอกสาร ENV_SETUP.md

## 🔧 สิ่งที่ต้องทำก่อน Deploy

### 1. ขอ TON API Key

1. เปิด Telegram และค้นหา: `@tonapibot`
2. พิมพ์: `/start`
3. พิมพ์: `/api_key`
4. คัดลอก API Key ที่ได้รับ

### 2. ตั้งค่า Environment Variables บน Vercel

ไปที่ **Vercel Dashboard → Settings → Environment Variables** และเพิ่ม:

| Variable Name | Value | หมายเหตุ |
|--------------|-------|----------|
| `TONCENTER_API_KEY` | `your_api_key_from_telegram` | จาก @tonapibot |
| `TONCENTER_API_URL` | `https://toncenter.com/api/v2/jsonRPC` | URL ของ API |
| `TON_NETWORK` | `mainnet` | หรือ `testnet` สำหรับทดสอบ |

**หมายเหตุ:** Environment Variables ที่มีอยู่แล้วไม่ต้องแก้ไข:
- ✅ `TREASURY_MNEMONIC` 
- ✅ `DEVELOPER_WALLET`
- ✅ `MONGODB_URI`
- ✅ `VITE_SOCKET_URL`

### 3. ทดสอบ Local ก่อน Deploy

```bash
# ไปที่โฟลเดอร์ server
cd server

# สร้างไฟล์ .env และเพิ่มค่าต่างๆ
# (ดูตัวอย่างใน ENV_SETUP.md)

# รัน server
npm start
```

ตรวจสอบ log ว่าเห็นข้อความนี้:
```
✅ Base DB Connected.
✅ TON Wallet Service Ready
[TON Wallet] Address: UQBc7kwY1XbqYVQ76dGi...
[TON Wallet] Balance: X.XXXX TON
```

### 4. ทดสอบการถอนเงิน (Testnet)

**แนะนำให้ทดสอบบน Testnet ก่อน:**

1. เปลี่ยน `TON_NETWORK=testnet`
2. เปลี่ยน `TONCENTER_API_URL=https://testnet.toncenter.com/api/v2/jsonRPC`
3. ใช้ testnet wallet และ testnet TON
4. ทดสอบถอนเงินจำนวนเล็กน้อย

### 5. Deploy บน Vercel

```bash
# Commit และ push โค้ด
git add .
git commit -m "Add automatic TON withdrawal system"
git push

# Vercel จะ auto-deploy
```

หรือ deploy manual:
```bash
vercel --prod
```

### 6. ตรวจสอบหลัง Deploy

1. ไปที่ Vercel Dashboard → Deployments → Logs
2. ตรวจสอบว่าเห็น log:
   ```
   ✅ TON Wallet Service Ready
   ```
3. ถ้าเห็น error ให้ตรวจสอบ Environment Variables

## ⚠️ คำเตือนสำคัญ

### ความปลอดภัย
- ❌ **อย่า commit** ไฟล์ `.env` ลง Git
- ❌ **อย่าแชร์** `TREASURY_MNEMONIC` กับใคร
- ✅ **ใช้ testnet** สำหรับทดสอบก่อนเสมอ
- ✅ **เก็บ API Key** เป็นความลับ

### Treasury Wallet
- ✅ ตรวจสอบยอดเงินในกระเป๋าเดฟเป็นประจำ
- ✅ เติมเงินเมื่อยอดเหลือน้อย
- ✅ ตั้ง alert เมื่อยอดต่ำกว่าที่กำหนด

### Rate Limits
- Free API Key: 10 requests/second
- ถ้ามีผู้เล่นถอนเงินพร้อมกันมาก อาจต้องใช้ Premium API

## 🎯 วิธีการทำงานของระบบ

1. ผู้เล่นกดถอนเงิน → Frontend ส่งคำขอไปที่ `/api/withdraw`
2. Backend ตรวจสอบยอดเงินผู้เล่นและกระเป๋าเดฟ
3. Backend ส่ง TON จากกระเป๋าเดฟไปยังกระเป๋าผู้เล่น (ผ่าน TON Wallet Service)
4. รอ transaction confirm บน blockchain (~10-30 วินาที)
5. หักเงินจากฐานข้อมูล
6. ส่ง Socket event แจ้งผู้เล่นว่าถอนเงินสำเร็จ
7. แสดง notification พร้อม transaction ID

## 📊 Monitoring

### Logs ที่ควรดู
```
[Withdrawal] Player requesting X TON
[TON Wallet] Treasury balance: X.XXXX TON
[TON Wallet] Sending X TON from treasury...
[TON Wallet] ✅ Transaction confirmed
[Withdrawal] ✅ Success! TX: xxxxx
```

### Error ที่อาจเจอ
- `Insufficient treasury balance` → เติมเงินในกระเป๋าเดฟ
- `TREASURY_MNEMONIC not found` → ตรวจสอบ Environment Variables
- `Transaction timeout` → ลองใหม่อีกครั้ง หรือเช็ค network

## � Troubleshooting - แก้ปัญหาที่พบบ่อย

### ❌ "WITHDRAWAL FAILED: Database error"

**สาเหตุ:** TON Wallet Service ไม่ได้ถูก initialize หรือ Environment Variables ไม่ครบ

**วิธีแก้:**

1. **ตรวจสอบ Vercel Logs:**
   - ไปที่ Vercel Dashboard → Deployments → Function Logs
   - ดูว่ามี error message ไหน

2. **ตรวจสอบ Environment Variables บน Vercel:**
   
   ต้องมีครบทั้ง 3 ตัว:
   ```
   ✅ TONCENTER_API_KEY
   ✅ TONCENTER_API_URL
   ✅ TON_NETWORK
   ```

3. **ตรวจสอบ TREASURY_MNEMONIC:**
   - ต้องมี 24 คำ (ไม่ใช่ 12 คำ)
   - ไม่มี comma หรือเครื่องหมายพิเศษ
   - คั่นด้วย space เท่านั้น
   - ตัวอย่าง: `word1 word2 word3 ... word24`

4. **Redeploy หลังเพิ่ม Environment Variables:**
   ```bash
   # หรือกด Redeploy ใน Vercel Dashboard
   vercel --prod
   ```

5. **ตรวจสอบ Server Logs:**
   
   ควรเห็น:
   ```
   ✅ Base DB Connected.
   ✅ TON Wallet Service Ready
   [TON Wallet] Address: UQBc7kwY...
   [TON Wallet] Balance: X.XXXX TON
   ```

   ถ้าเห็น:
   ```
   ⚠️ TON Wallet Service failed to initialize
   ```
   → แปลว่า Environment Variables ไม่ครบหรือไม่ถูกต้อง

### ❌ "Withdrawal service unavailable"

**สาเหตุ:** TON Wallet Service ไม่พร้อมใช้งาน

**วิธีแก้:**
- ตรวจสอบว่าได้เพิ่ม `TONCENTER_API_KEY` แล้วหรือยัง
- ตรวจสอบว่า `TREASURY_MNEMONIC` ถูกต้อง (24 คำ)
- Redeploy อีกครั้ง

### ❌ "Insufficient treasury balance"

**สาเหตุ:** กระเป๋าเดฟไม่มีเงินเพียงพอ

**วิธีแก้:**
- เติมเงิน TON เข้ากระเป๋าเดฟ
- ตรวจสอบยอดเงินที่ https://tonscan.org

### ❌ "Transaction timeout"

**สาเหตุ:** TON blockchain ช้าหรือ network มีปัญหา

**วิธีแก้:**
- ลองถอนใหม่อีกครั้ง
- ตรวจสอบ TON network status
- ถ้าใช้ testnet ให้เปลี่ยนเป็น mainnet

## 📋 Checklist การตรวจสอบ Environment Variables

ก่อน Deploy ให้ตรวจสอบว่ามีครบทั้งหมด:

```bash
# Required for Database
✅ MONGODB_URI=mongodb+srv://...

# Required for Treasury Wallet
✅ TREASURY_MNEMONIC=word1 word2 word3 ... word24
✅ DEVELOPER_WALLET=UQBc7kwY...

# Required for TON API (ใหม่!)
✅ TONCENTER_API_KEY=your_api_key_from_telegram
✅ TONCENTER_API_URL=https://toncenter.com/api/v2/jsonRPC
✅ TON_NETWORK=mainnet

# Optional
PORT=3001
```

## �🚀 พร้อม Deploy แล้ว!

ทำตาม checklist นี้ทีละขั้นตอน และระบบถอนเงินอัตโนมัติจะพร้อมใช้งาน
