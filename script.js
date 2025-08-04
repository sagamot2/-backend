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
const orderList = document.getElementById('orderList');
const totalRevenue = document.getElementById('totalRevenue');
const filterDate = document.getElementById('filterDate');
const salesChartCtx = document.getElementById('salesChart').getContext('2d');
const orderCount = document.getElementById('orderCount');
const resetQueueBtn = document.getElementById('resetQueueBtn');

let chartInstance = null;
const notificationSound = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');

const validUsername = "pinny";
const validPassword = "020116";

loginBtn.addEventListener("click", () => {
  const user = usernameInput.value.trim();
  const pass = passwordInput.value.trim();
  if (user === validUsername && pass === validPassword) {
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
}

function initAdmin() {
  const today = new Date().toISOString().slice(0, 10);
  if (!filterDate.value) filterDate.value = today;
  loadOrdersRealtime(filterDate.value);
  listenNewOrdersRealtime(filterDate.value);
}

function loadOrdersRealtime(date) {
  orderList.innerHTML = "กำลังโหลด...";
  totalRevenue.textContent = "0.00";
  orderCount.textContent = "0";

  db.ref("orders").orderByChild("timestamp").startAt(date).endAt(date + "\uf8ff").once("value").then(snapshot => {
    let orders = [];
    snapshot.forEach(snap => {
      let order = snap.val();
      order.key = snap.key;
      if (order.timestamp?.startsWith(date)) orders.push(order);
    });

   orders.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (orders.length === 0) {
      orderList.textContent = "ยังไม่มีคำสั่งซื้อ";
      updateChart([]);
      orderCount.textContent = "0";
      totalRevenue.textContent = "0.00";
      return;
    }

    orderList.innerHTML = "";
    let sum = 0;
    orders.forEach((order, idx) => {
      sum += order.total;

      const localTime = new Date(order.timestamp).toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });

      const queueNumber = idx + 1;

      const div = document.createElement("div");
      div.classList.add("order-item");
      div.innerHTML = `
        <p><strong>คิวที่:</strong> ${queueNumber}</p>
        <p><strong>เวลา:</strong> ${localTime}</p>
        <p><strong>ชำระเงิน:</strong> ${order.paymentMethod}</p>
        <ul>
          ${order.items.map(i => `<li>${i.name} x${i.qty} = ${(i.price * i.qty).toFixed(2)} บาท</li>`).join('')}
        </ul>
        <p><strong>รวม:</strong> ${order.total.toFixed(2)} บาท</p>
        ${order.note ? `<p><strong>หมายเหตุ:</strong> ${order.note}</p>` : ""}
        <p><strong>สถานะ:</strong> 
          <span class="status-text ${order.status === 'ทำเสร็จแล้ว' ? 'done' : 'pending'}">
            ${order.status || 'ยังไม่ระบุ'}
          </span>
        </p>
        <div class="order-actions">
          <button class="status-pending" onclick="updateOrderStatus('${order.key}', 'รอทำ')">รอกำลังทำ</button>
          <button class="status-done" onclick="updateOrderStatus('${order.key}', 'ทำเสร็จแล้ว')">ทำเสร็จแล้ว</button>
          <button class="delete-order" onclick="deleteOrder('${order.key}')">ลบ</button>
        </div>
      `;
      orderList.appendChild(div);
    });

    totalRevenue.textContent = sum.toFixed(2);
    orderCount.textContent = orders.length;
    updateChart(orders);
  });
}

function updateOrderStatus(key, status) {
  db.ref("orders/" + key + "/status").set(status)
    .then(() => {
      Toastify({ text: `อัปเดตสถานะเป็น: ${status}`, duration: 3000, gravity: "top", position: "right", backgroundColor: "#3498db" }).showToast();
      loadOrdersRealtime(filterDate.value);
    });
}

function listenNewOrdersRealtime(date) {
  db.ref("orders").orderByChild("timestamp").startAt(date).endAt(date + "\uf8ff").on("child_added", snap => {
    const order = snap.val();
    if (order.timestamp?.startsWith(date)) {
      playNotificationSound();
      Toastify({
        text: `มีออเดอร์ใหม่: ${order.total.toFixed(2)} บาท`,
        duration: 4000,
        close: true,
        gravity: "top",
        style: { background: "#e74c3c" }
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
      loadOrdersRealtime(filterDate.value);
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

function playNotificationSound() {
  notificationSound.play();
}

filterDate.addEventListener("change", e => {
  loadOrdersRealtime(e.target.value);
});

function resetLastOrderNumber() {
  return db.ref("lastOrderNumber").set(0);
}

resetQueueBtn.addEventListener("click", () => {
  if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการรีเซตคิว (ลบคำสั่งซื้อทั้งหมดในวันนี้)?")) return;

  const date = filterDate.value || new Date().toISOString().slice(0, 10);
  db.ref("orders").orderByChild("timestamp").startAt(date).endAt(date + "\uf8ff").once("value")
    .then(snapshot => {
      const updates = {};
      snapshot.forEach(snap => {
        if (snap.val().timestamp?.startsWith(date)) {
          updates[snap.key] = null;
        }
      });
      return db.ref("orders").update(updates);
    })
    .then(() => {
      return resetLastOrderNumber();
    })
    .then(() => {
      Toastify({ text: "รีเซตคิวและเลขออเดอร์เรียบร้อยแล้ว", duration: 3000, gravity: "top", position: "right", backgroundColor: "#4caf50" }).showToast();
      loadOrdersRealtime(filterDate.value);
    })
    .catch(err => {
      Toastify({ text: err.message, duration: 3000, gravity: "top", position: "right", backgroundColor: "#c0392b" }).showToast();
    });
});

checkLogin();
