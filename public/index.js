let transactions = [];
let myChart;

fetch("/api/transaction")
    .then(response => {
        return response.json();
    })
    .then(data => {
        // save db data on global variable
        transactions = data;

        populateTotal();
        populateTable();
        populateChart();
    });

function populateTotal() {
    // reduce transaction amounts to a single total value
    let total = transactions.reduce((total, t) => {
        return total + parseInt(t.value);
    }, 0);

    let totalEl = document.querySelector("#total");
    totalEl.textContent = total;
}

function populateTable() {
    let tbody = document.querySelector("#tbody");
    tbody.innerHTML = "";

    transactions.forEach(transaction => {
        // create and populate a table row
        let tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

        tbody.appendChild(tr);
    });
}

function populateChart() {
    // copy array and reverse it
    let reversed = transactions.slice().reverse();
    let sum = 0;

    // create date labels for chart
    let labels = reversed.map(t => {
        let date = new Date(t.date);
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    });

    // create incremental values for chart
    let data = reversed.map(t => {
        sum += parseInt(t.value);
        return sum;
    });

    // remove old chart if it exists
    if (myChart) {
        myChart.destroy();
    }

    let ctx = document.getElementById("myChart").getContext("2d");

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: "Total Over Time",
                fill: true,
                backgroundColor: "#6666ff",
                data
            }]
        }
    });
}
let db = undefined;

function saveRecord(budgetTansaction) {
    // Ref: Using IndexedDB web APIs - MDN docs
    // Let us open our database
    console.log("saveRecord: opening database");
    var request = window.indexedDB.open("budget", 1);
    // error handler
    request.onerror = function(event) {
        // Do something with request.errorCode!
        console.log(request.errorCode);
    };
    // create object store here
    // This event is only implemented in recent browsers
    request.onupgradeneeded = function(event) {
        console.log("onupgradeneeded has been triggered!");
        // Save the IDBDatabase interface
        db = event.target.result;
        // Create an objectStore for this database
        console.log("onupgradeneeded creating object store!");
        var objectStore = db.createObjectStore("transactions", { autoIncrement: true });
        // Use transaction oncomplete to make sure the objectStore creation is
        // finished before adding data into it.
        // Use transaction oncomplete to make sure the objectStore creation is
        // finished before adding data into it.
        objectStore.transaction.oncomplete = function(event) {
            // Store values in the newly created objectStore.
            var transactionObjectStore = db.transaction("transactions", "readwrite").objectStore("transactions");
            transactionObjectStore.add(budgetTansaction);
        };
    };
    // Add data
    if (db !== undefined) {
        var transaction = db.transaction(["transactions"], "readwrite");
        // Do something when all the data is added to the database.
        transaction.oncomplete = function(event) {
            console.log("All done!");
        };

        transaction.onerror = function(event) {
            // Don't forget to handle errors!
            console.log("transaction (readwrite) failed!");
        };
        var objectStore = transaction.objectStore("transactions");
        var request = objectStore.add(budgetTansaction);
        request.onsuccess = function(event) {
            console.log("New transaction added!", event.target.result);
        };
    }
}

function sendTransaction(isAdding) {
    let nameEl = document.querySelector("#t-name");
    let amountEl = document.querySelector("#t-amount");
    let errorEl = document.querySelector(".form .error");

    // validate form
    if (nameEl.value === "" || amountEl.value === "") {
        errorEl.textContent = "Missing Information";
        return;
    } else {
        errorEl.textContent = "";
    }

    // create record
    let transaction = {
        name: nameEl.value,
        value: amountEl.value,
        date: new Date().toISOString()
    };

    // if subtracting funds, convert amount to negative number
    if (!isAdding) {
        transaction.value *= -1;
    }

    // add to beginning of current array of data
    transactions.unshift(transaction);

    // re-run logic to populate ui with new record
    populateChart();
    populateTable();
    populateTotal();

    // also send to server
    fetch("/api/transaction", {
            method: "POST",
            body: JSON.stringify(transaction),
            headers: {
                Accept: "application/json, text/plain, */*",
                "Content-Type": "application/json"
            }
        })
        .then(response => {
            return response.json();
        })
        .then(data => {
            if (data.errors) {
                errorEl.textContent = "Missing Information";
            } else {
                // clear form
                nameEl.value = "";
                amountEl.value = "";
            }
        })
        .catch(err => {
            // fetch failed, so save in indexed db
            saveRecord(transaction);

            // clear form
            nameEl.value = "";
            amountEl.value = "";
        });
}


document.querySelector("#add-btn").onclick = function() {
    sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function() {
    sendTransaction(false);
};

// Reference: MDN - Using IndexedDB- Web APIs
function getAllRecords() {
    // Retrieve all data
    if (db !== undefined) {
        var transaction = db.transaction(["transactions"]);
        var objectStore = transaction.objectStore("transactions");
        objectStore.getAll().onsuccess = function(event) {
            console.log("Got all transactions:");
            console.log(event.target.result);
            // send bulk fetch to server here
            fetch("/api/transaction/bulk", {
                    method: "POST",
                    body: JSON.stringify(event.target.result),
                    headers: {
                        Accept: "application/json, text/plain, */*",
                        "Content-Type": "application/json"
                    }
                })
                .then(response => {
                    return response.json();
                })
                .catch(err => {
                    console.info("POST bulk failed!");
                    console.log(err);
                });
            // send bulk fetch to server here
        };
    }

}
// add listener for going online
window.addEventListener('online', function(e) {
    console.log('We are online now!!!');
    getAllRecords();
});