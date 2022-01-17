/*  internal requirements  */
const fs            = require("fs")

/*  external requirements  */
const Excel         = require("exceljs")
const chalk         = require("chalk")

/*  establish asynchronous processing environment  */
;const { listenerCount } = require("process");
(async () => {

    /*  open Excel sheet with index information  */
    let workbook = new Excel.Workbook()
    await workbook.xlsx.readFile("license-modeling.xlsx")

    var licenseDeclarations = []
    var licenseClasses = []

    /*  use type obligation combination matrix  */

    workbook.eachSheet(function(worksheet){
        if(worksheet.state != "hidden") 
            licenseClasses = licenseClasses.concat(worksheet.name)

        worksheet.eachRow(function(row, rowNumber){
            row.eachCell(function(cell, colNumber){
                licenseDeclaration = {}

                if(rowNumber > 1 && colNumber > 1 && worksheet.state != "hidden") {
                    licenseDeclaration.class = worksheet.name
                    licenseDeclaration.pos = ((rowNumber-2)*14)+(colNumber-1)
                    licenseDeclaration.useType = worksheet.getCell(1,colNumber).value
                    licenseDeclaration.obligate = worksheet.getCell(rowNumber,1).value
                    licenseDeclaration.richText = cell.value.richText
                    licenseDeclaration.requiresAdditionalUseType = null


                /*  put license text into a var  */
                var s = cell.value.result
                if (s != undefined) {
                    s = s.split('"').join("")
                    s = s.split('"').join("")
                    s = s.split('\'').join("")
                    s = s.split('\n').join("")
                    if (s.includes('&')) {
                        licenseDeclaration.richText = `"${s.split('&')[0]}"`
                        licenseDeclaration.requiresAdditionalUseType = s.split('&')[1]
                    } else {
                        licenseDeclaration.richText = `"${s}"`
                    }
                } else {
                    let help = cell.value
                    if (typeof(help) == "string" && help.includes('&')) {
                        help = help.split('"').join("")
                        help = help.split('"').join("")
                        help = help.split('\'').join("")
                        licenseDeclaration.richText = `"${help.split('&')[0]}"`
                        licenseDeclaration.requiresAdditionalUseType = help.split('&')[1]
                    } else
                        licenseDeclaration.richText = cell.value
                }

                /*  concatenate rich text of a cell and mark bold words  */
                var excerpt = "" 
                if(cell.value.richText != undefined){
                    cell.value.richText.forEach((rt) => {
                        if(rt.font != undefined && rt.font.bold != undefined) {
                            excerpt = excerpt.concat(`<b>${rt.text}</b>`)
                        } else {
                            excerpt = excerpt.concat(rt.text)
                        }
                        
                    })

                    /*  remove special characters  */
                    excerpt = excerpt.split('"').join("")
                    excerpt = excerpt.split('"').join("")
                    excerpt = excerpt.split('"').join("")
                    excerpt = excerpt.split('\n').join("")

                    if (excerpt.includes('&')) {
                        licenseDeclaration.richText = excerpt.split('&')[0]
                        licenseDeclaration.requiresAdditionalUseType = excerpt.split('&')[1]
                    } else {
                        licenseDeclaration.richText = `"${excerpt}"`
                    }
                }                   

                    /*  detect color of cell to set obligation / explicit  */
                    if(cell.fill != undefined){
                        var color = cell.fill  
                        if(color.fgColor != "undefined") {
                            if(color.fgColor.tint != undefined) {
                                if(color.fgColor.tint == "0.3999755851924192" && color.fgColor.theme == 4){
                                    licenseDeclaration.explicit = true
                                    licenseDeclaration.obligation = "OBLIGATION"
                                } else if(color.fgColor.tint == "0.5999938962981048" && color.fgColor.theme == 4){
                                    licenseDeclaration.explicit = false
                                    licenseDeclaration.obligation = "OBLIGATION" 
                                } else if(color.fgColor.tint == "0.3999755851924192" && color.fgColor.theme == 5){
                                    licenseDeclaration.explicit = true
                                    licenseDeclaration.obligation = "NOT_OBLIGATION_SINGLE" 
                                } else if(color.fgColor.tint == "0.5999938962981048" && color.fgColor.theme == 5){
                                    licenseDeclaration.explicit = true
                                    licenseDeclaration.obligation = "NOT_OBLIGATION_SINGLE" 
                                }
                            } else if (color.fgColor.argb != undefined) {
                                if(color.fgColor.argb == "FFFF4C33"){
                                    licenseDeclaration.explicit = false
                                    licenseDeclaration.obligation = "NOT_OBLIGATION_GLOBAL"
                                } else if(color.fgColor.argb == "FFFB9581"){
                                    licenseDeclaration.explicit = true
                                    licenseDeclaration.obligation = "NOT_OBLIGATION_GLOBAL"
                                } 
                            }
                        }   
                        
                    }
                    licenseDeclarations.push(licenseDeclaration)  
                }
            })
        })
    })

    licenseDeclarations = licenseDeclarations.filter(ld => ld.richText != undefined && ld.richText != '""')

    str = ""

    licenseClasses.forEach((lc) => {
        str = str.concat(`[LicenseClass: ${lc}]\nname = ${lc}\napproved = true\ndeleted = false\n\n`)
    })

    licenseDeclarations.forEach((ld, i) => {
        str = str.concat(`[LicenseDeclaration: dec${i}]\nbelongsToUTOC = @utoc${ld.pos}\nrequireAdditionalUseType = ${ld.requiresAdditionalUseType}\nlicenseClass = @${ld.class}\nrichText = ${ld.richText}\nexplicit = ${ld.explicit}\nobligate = ${ld.obligation}\n\n`)
    })
    
    var obj = JSON.stringify(licenseDeclarations, null, 4)

    fs.writeFileSync("test-json.json", obj, { encoding: "utf8" })
    fs.writeFileSync("test-json.ini", str, { encoding: "utf8" })

})().catch((err) => {
    /*  fatal error handling  */
    process.stderr.write(`** af: ${chalk.red("ERROR:")} ${err.stack}\n`)
    process.exit(1)
})