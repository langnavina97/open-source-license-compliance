class Evaluation {
    constructor (name, version, useType) {
        this.name = name
        this.license = ""
        this.defcon = Number.POSITIVE_INFINITY
        this.children = []
        this.version = version
        this.useType = useType
    }

    setClause (clause) {
        this.clause = clause
    }

    setObligation (obligation) {
        this.obligation = obligation
    }

    setDependent (component) {
        this.children.push(component)
    }

    setDefcon (defcon) {
        this.defcon = defcon
    }

    setLicense(license) {
        this.license = license
    }
    
}

class Defcon {

    static evaluateProduct(componentUsages, productName) {
        
        let components = []
        let defcon = Number.POSITIVE_INFINITY
        for (let componentUsage of componentUsages) {
            let ev = this.calcDefconLevelForComponentUsage(componentUsage)
            components.push(ev)
            defcon = Math.min(defcon, ev.defcon)
        }

        return {name: productName, defcon: defcon, children: components}
    }

    /*  calculates the worst case of the defcons of the component and all transitive dependencies   */
    static calcDefconLevelForComponentUsage (componentUsage) {

        /*  create a new object with information about component  */
        let evaluation = new Evaluation(componentUsage.component.name, componentUsage.version, componentUsage.isSpecifiedWith)

        /*  calculates defcon of componentUsage (first level)  */
        let defcon = this.calcDefconLevelForComponent(componentUsage.component, componentUsage, componentUsage.isSpecifiedWith, evaluation)

        /*  calculated dependent components and calculates the worst case  */
        for (const dependentComponent of componentUsage.component.dependsOn) {
            const evaluationDep = this.calcDefconLevelForComponentUsage(dependentComponent)
            evaluation.setDependent(evaluationDep)
            defcon = Math.min(defcon, evaluationDep.defcon)
        }

        /*  writes the calculated defcon level into the object  */
        evaluation.setDefcon(defcon)

        return evaluation
    }
    
    /*  evaluate defcons of each component and apply the formula  */
    static calcDefconLevelForComponent (component, componentUsage, useTypes, evaluation) {
        /*  find range, in which the used component lies  */
        const version = componentUsage.version.arithmetic
        const componentVersionRange = component.definedRange.find((range) => {
            return range.from.arithmetic <= version && range.to != undefined && version <= range.to.arithmetic
        })

        /*  calculates the defcons of each license including subsequent licenses (dual licensing) which are put into the formula  */
        let defcons = [ null, null, null, null ]
        for (const licenseReference of componentVersionRange.licenseReferences) {
            if (licenseReference.subsequent) {
                /*  put subsequent licenses into a list (e.g. GPLv3 or higher) and calculate the defcons  */
                let licensesS = [ licenseReference.license ]
                for (const license = licenseReference.license; license.subsequent != null; license = license.subsequent) 
                    licensesS.push(license.subsequent)
                let defcon = licensesS.map((license) => this.calcDefconLevelForLicense(license, usageTypes, evaluation))

                /*  aggregate calculated defcons to the best option with least burdens  */
                defcons[licenseReference.position - 1] = defconsS.reduce((a,b) => Math.max(a,b), Number.NEGATIVE_INFINITY)
            } 
            else
                defcons[licenseReference.position - 1] = this.calcDefconLevelForLicense(licenseReference.license, useTypes, evaluation)
        }

        /*  evaluate formula for multi-licensing (X1 AND X2) OR (X3 AND X4) for multi licensing  */
        let defcon = this.licenseOr(
            this.licenseAnd(defcons[0], defcons[1]), 
            this.licenseAnd(defcons[2], defcons[3])
        )

        return defcon
    }

    /*  calculates the defcon for a specific license  */
    static calcDefconLevelForLicense(license, usageTypes, evaluation) {
        /*  special case for base classes  */
        if (license.basedOn != null) 
            license = license.basedOn

        /*  start with maximum defcon level  */
        let defcon = Number.POSITIVE_INFINITY

        /*  bring license declarations in matrix structur, ordered into a map (obligations, [licenseDeclaration])  */
        let matrix = new Map()
        for (const licenseDeclaration of license.licenseDeclarations) {
            /*  skip non-relevant usetypes  */
            if (!usageTypes.includes(licenseDeclaration.belongsToUseTypeObligationCombination.belongsToUseType.name)) 
                continue

            /*  sort declarations into obligation-keyed matrix row  */
            const obligation = licenseDeclaration.belongsToUseTypeObligationCombination.belongsToObligation.name
            let licenseDeclarations = matrix.get(obligation)
            if (licenseDeclarations == undefined) 
                licenseDeclarations = []
            licenseDeclarations.push(licenseDeclaration)
            matrix.set(obligation, licenseDeclarations)
        }

        /*  iterative over matrix row wise (obligations)  */
        let burdens = []
        let clauses = []
        let prev_defcon = 0
        loop:
        for (const obligation of matrix.keys()) {
            prev_defcon = defcon
            /*  iterate over matrix column wise (use types)  */
            for (const licenseDeclaration of matrix.get(obligation)) {
                /*  CASE 1: stop processing of entire matrix  */
                if (licenseDeclaration.obligate == "NOT_OBLIGATION_GLOBAL") {
                    if (licenseDeclaration.requireAdditionalUseType == null || 
                        (licenseDeclaration.requireAdditionalUseType != null && 
                        usageTypes.includes(licenseDeclaration.requireAdditionalUseType.name)))
                        return Number.POSITIVE_INFINITY
                }
                
                /*  CASE 2: stop processing of obligation line (this obligation)  */
                if (licenseDeclaration.obligate == "NOT_OBLIGATION_SINGLE"){
                    if (licenseDeclaration.requireAdditionalUseType == null || 
                        (licenseDeclaration.requireAdditionalUseType != null && 
                        usageTypes.includes(licenseDeclaration.requireAdditionalUseType.name)))
                        defcon = prev_defcon
                        continue loop
                }

                /*  CASE 3: usetypes already sorted above, not in case it has been already mitigated  */
                if (licenseDeclaration.belongsToUseTypeObligationCombination.hasMitigation == undefined) {
                    defcon = Math.min(defcon, licenseDeclaration.belongsToUseTypeObligationCombination.defconLevel)
                    
                    if (!burdens.includes(licenseDeclaration.belongsToUseTypeObligationCombination.belongsToObligation.description))
                        burdens.push(licenseDeclaration.belongsToUseTypeObligationCombination.belongsToObligation.description)
                    
                    let clause = {}
                    clause.declaration = licenseDeclaration.belongsToUseTypeObligationCombination
                    clause.excerpt = licenseDeclaration.excerpt
                    clauses.push(clause)
                }

                /*  CASE 4: in case it has been partially mitigated  */
                else if (licenseDeclaration.belongsToUseTypeObligationCombination.hasMitigation != null && 
                    licenseDeclaration.belongsToUseTypeObligationCombination.hasMitigation.partially) {
                    defcon = Math.min(defcon, licenseDeclaration.belongsToUseTypeObligationCombination.defconLevel + 2)
                }
                    
            }
        }
   
        evaluation.setLicense(license)
        evaluation.setObligation(burdens)
        evaluation.setClause(clauses)
        return defcon
    }

    /*  special and from our formula (e.g. MIT and additional conditions)  */
    static licenseAnd(x, y) {
        if      (x == null && y != null) return y
        else if (x != null && y == null) return x
        else if (x != null && x != null) return Math.min(x, y) 
        else 
            return null
    }

    /*  special or from our formula (dual licensing)  */
    static licenseOr(x, y) {
        if      (x == null && y != null) return y
        else if (x != null && y == null) return x
        else 
            return Math.max(x, y)
    }
}

module.exports = Defcon