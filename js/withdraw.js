<select id="payment-type">
  <option value="upi">UPI</option>
  <option value="bank">Bank Transfer</option>
</select>

<div id="upi-field">
  <input type="text" id="withdraw-upi" placeholder="UPI ID">
</div>

<div id="bank-fields" style="display:none">
  <input type="text" id="withdraw-account" placeholder="Account Number">
  <input type="text" id="withdraw-ifsc" placeholder="IFSC Code">
</div>

<!-- Required IDs for script -->
<span id="user-balance">0</span>
<ul id="history-list"></ul>
<p id="withdraw-msg"></p>

<audio id="success-sound" src="assets/sounds/success.mp3" preload="auto"></audio>
