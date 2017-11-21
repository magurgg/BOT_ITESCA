// Write your Javascript code.
function myFunction(x) {
    var t = document.getElementById('myTable');
    document.getElementById("TBQuestion").value = t.rows[x.rowIndex].cells[0].innerHTML;
    document.getElementById("TBAnswer").value = t.rows[x.rowIndex].cells[1].innerHTML;
}
function clicTrainAndPublish() {
    alert("Click train and publish");
}