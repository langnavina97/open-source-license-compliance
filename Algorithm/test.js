const Defcon = require('./Defcon.js')
const fs             = require("fs")

const c1 = require('./bootstrap/bootstrap-business-test.json')
const c2 = require('./SpringBoot/spring-boot.json')


const product = [ c1, c2 ]

const evaluationTree = Defcon.evaluateProduct(product, "MyProduct")

//const evaluationTree = Defcon.calcDefconLevelForComponentUsage(c7)
var defconTree = JSON.stringify(evaluationTree, null, 4)
//console.log(defconTree)

// infinity evaluates to null in json
//console.log(evaluationTree)

fs.writeFileSync("ProductMock.json", defconTree, { encoding: "utf8" })