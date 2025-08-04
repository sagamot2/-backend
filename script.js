const firebaseConfig = {
  apiKey: "AIzaSyBS__oDn1BoIBG8TiYQks6mFwQd9sBFn_Q",
  authDomain: "somtam-da7ab.firebaseapp.com",
  databaseURL: "https://somtam-da7ab-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "somtam-da7ab",
  storageBucket: "somtam-da7ab.appspot.com",
  messagingSenderId: "388718531258",
  appId: "1:388718531258:web:f673d147f1c3357d4ea883",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const loginPage = document.getElementById('loginPage');
const adminPage = document.getElementById('adminPage');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const orderList = document.getElementById("orderList");
const totalRevenue = document.getElementById("totalRevenue");
const filterDate = document.getElementById("filterDate");
const salesChartCtx = document.getElementById('salesChart').getContext('2d');

let chartInstance = null;
const notificationSound = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
const validUsername = "pinny";
const validPasswordHash = "24b899e8e3d9c1d09be71c3f79e5e62584ec67af6d7a1ab01e46be9e1bf47749";
loginBtn.addEventListener("click", async () => {
  const user = usernameInput.value.trim();
  const pass = passwordInput.value.trim();
  const passHash = await sha256(pass);

  if (user === validUsername && passHash === validPasswordHash) {
    sessionStorage.setItem("loggedIn", "true");
    showAdminPage();
    initAdmin();
  } else {
    showError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  }
});

function showError(msg) {
  const errorElem = document.getElementById("loginError");
  errorElem.textContent = msg;
  errorElem.classList.remove("hidden");
}

function checkLogin() {
  const loggedIn = sessionStorage.getItem("loggedIn");
  if (loggedIn === "true") {
    showAdminPage();
    initAdmin();
  } else {
    showLoginPage();
  }
}

logoutBtn.onclick = () => {
  sessionStorage.removeItem("loggedIn");
  showLoginPage();
};

function showLoginPage() {
  loginPage.classList.remove("hidden");
  adminPage.classList.add("hidden");
}

function showAdminPage() {
  loginPage.classList.add("hidden");
  adminPage.classList.remove("hidden");
  document.getElementById('loginError').classList.add("hidden");
}

function initAdmin() {
  const today = new Date().toISOString().slice(0, 10);
  if (!filterDate.value) filterDate.value = today;
  loadOrdersRealtime(today);
  listenNewOrdersRealtime(today);
}

function loadOrdersRealtime(date) {
  orderList.innerHTML = "กำลังโหลด...";
  totalRevenue.textContent = "0.00";

  db.ref("orders").orderByKey().on("value", snapshot => {
    orderList.innerHTML = "";
    let sum = 0;
    const orders = [];

    snapshot.forEach(snap => {
      const order = snap.val();
      if (order.timestamp?.startsWith(date)) {
        order.key = snap.key;
        orders.push(order);
      }
    });

    if (orders.length === 0) {
      orderList.textContent = "ยังไม่มีคำสั่งซื้อ";
      updateChart([]);
      document.getElementById('orderCount').textContent = 0;
      return;
    }

    for (const order of orders) {
      const div = document.createElement("div");
      div.classList.add("order-item");
      div.innerHTML = `
        <p><strong>เวลา:</strong> ${order.timestamp}</p>
        <p><strong>ชำระเงิน:</strong> ${order.paymentMethod}</p>
        <ul>
          ${order.items.map(i => `<li>${i.name} x${i.qty} = ${i.price * i.qty} บาท</li>`).join('')}
        </ul>
        <p><strong>รวม:</strong> ${order.total} บาท</p>
        ${order.note ? `<p><strong>หมายเหตุ:</strong> ${order.note}</p>` : ""}
        <button onclick="deleteOrder('${order.key}')">ลบ</button>
      `;
      orderList.appendChild(div);
      sum += order.total;
    }

    totalRevenue.textContent = sum.toFixed(2);
    updateChart(orders);
    document.getElementById('orderCount').textContent = orders.length;
  });
}

function listenNewOrdersRealtime(date) {
  db.ref("orders").orderByKey().startAt(date).on("child_added", snap => {
    const order = snap.val();
    if (order.timestamp?.startsWith(date)) {
      playNotificationSound();
      Toastify({
        text: `มีออเดอร์ใหม่: ${order.total} บาท`,
        duration: 4000,
        close: true,
        gravity: "top",
        position: "right",
        backgroundColor: "#4caf50",
      }).showToast();
      loadOrdersRealtime(date);
    }
  });
}

function deleteOrder(key) {
  if (!confirm("ลบคำสั่งซื้อนี้ใช่ไหม?")) return;
  db.ref("orders/" + key).remove()
    .then(() => {
      Toastify({ text: "ลบแล้ว", duration: 3000, gravity: "top", position: "right", backgroundColor: "#e74c3c" }).showToast();
    })
    .catch(err => {
      Toastify({ text: err.message, duration: 3000, gravity: "top", position: "right", backgroundColor: "#c0392b" }).showToast();
    });
}
window.deleteOrder = deleteOrder;

function updateChart(orders) {
  const dataByDate = {};
  orders.forEach(o => {
    const d = o.timestamp.slice(0, 10);
    dataByDate[d] = (dataByDate[d] || 0) + o.total;
  });

  const labels = Object.keys(dataByDate).sort();
  const data = labels.map(d => dataByDate[d]);

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.update();
  } else {
    chartInstance = new Chart(salesChartCtx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "รายได้ (บาท)",
          data,
          backgroundColor: "rgba(54,162,235,0.6)"
        }]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } }
      }
    });
  }
}

filterDate.addEventListener("change", e => {
  loadOrdersRealtime(e.target.value);
});

function playNotificationSound() {
  notificationSound.play();
}

checkLogin();
