# BusOne - Final Demo Build

BusOne is a Flask + SQLite + HTML/CSS/JavaScript bus-management demo with:

- Admin login/dashboard
- Driver login/dashboard
- Passenger login/dashboard
- Bus and driver data APIs
- Driver-to-bus assignment API
- Passenger-to-bus assignment API
- Daily attendance QR generation for the assigned driver
- Passenger QR scanning and attendance marking
- Attendance history
- One-day payment demo API
- Notifications API

## Run without editing code

Use the frontend through localhost, not by opening the HTML file directly. This is especially important for the passenger camera QR scanner.

## Demo accounts already included

### Admin
- Email: `vrushabhgite867@gmail.com`
- Password: `Vrushi`
- Role: Admin

### Driver
- Email: `driver@busone.com`
- Password: `driver123`
- Role: Driver

### Passenger
- Email: `test@busone.com`
- Password: `test123`
- Role: Passenger

The demo database already contains bus `MH-16-2002`, driver assignment, passenger assignment, and an active monthly pass.

## QR attendance demo

1. Login as Driver.
2. Click **Generate Today's QR**.
3. Keep the driver QR visible on the screen/phone.
4. Login as Passenger on another device/browser.
5. Open **Scan Attendance QR** and allow camera access.
6. Scan the driver's QR.
7. Backend verifies the QR date, passenger account and passenger-to-bus assignment.
8. Attendance is stored in SQLite for the current date.

The QR is unique per bus/day and expires at the next day.

## Important

This is a underworking project. Passwords are intentionally kept simple in the SQLite demo database. For a production deployment, use password hashing, authentication tokens/sessions, HTTPS, proper authorization, and a production database.

## how to run this project 
for frontend

cd "C:\Users\vrush\OneDrive\Desktop\BusOne\BUS\Frontend"
python -m http.server 5500 --bind 0.0.0.0

backend

cd "C:\Users\vrush\OneDrive\Desktop\BusOne\BUS\Backend"
python app.py
