const fs = require('fs')
const {
    recipes,
    store_stock
} = require('./recipes')
const fileArg = process.argv[2]
const {
    production_hubs,
    demands,
    region_abbreviations
} = require(`./${fileArg}`)

const getRegionNames = (arg) =>
    arg !== "all" && arg.split(',').reduce((arr, abbv) => (arr.concat(region_abbreviations[abbv])), []).filter(Boolean)

let totalsRaw = {}
let productionHubsList = Object.entries(production_hubs);
let demandsList = Object.entries(demands);
let productionHubsArg = process.argv[3] && getRegionNames(process.argv[3])
let demandArg = process.argv[4] && getRegionNames(process.argv[4])

productionHubsList = productionHubsArg ? productionHubsList.filter(([, {
    serving_regions
}]) => regions.some(region => productionHubsArg.includes(region))) : productionHubsList
demandsList = demandArg ? demandsList.filter(([name]) => demandArg.includes(name)) : demandsList

productionHubsList.forEach(([regionName, {
    infrastructure: buildingsList,
    regions
}]) => {
    Object.entries(buildingsList).forEach(([buildingName, buildings]) => {
        let recipe = recipes[buildingName]
        let productionRate = buildings.reduce((sum, {
            harvesters,
            efficiency,
            off
        }) => {
            return off ? sum : sum + harvesters * (30 / (recipe.base_processing_time / efficiency))
        }, 0)
        Object.entries(recipe.products).forEach(([product, quantity]) => {
            totalsRaw[product] = totalsRaw[product] || {}
            if (productionHubsList.length > 1) {
                totalsRaw[product]['produced'] = totalsRaw[product]['produced'] || {}
                totalsRaw[product]['produced']['total'] = (totalsRaw[product]['produced']['total'] || 0) + (quantity * productionRate)
                totalsRaw[product]['produced'][regionName] = (totalsRaw[product]['produced'][regionName] || 0) + (quantity * productionRate)
            } else {
                totalsRaw[product]['produced'] = (totalsRaw[product]['produced'] || 0) + (quantity * productionRate)
            }
        })
        if (recipe.ingredients) {
            Object.entries(recipe.ingredients).forEach(([ingredient, quantity]) => {
                totalsRaw[ingredient] = totalsRaw[ingredient] || {}
                if (productionHubsList.length > 1) {
                    totalsRaw[ingredient]['produced'] = totalsRaw[ingredient]['produced'] || {}
                    totalsRaw[ingredient]['produced']['total'] = (totalsRaw[ingredient]['produced']['total'] || 0) - (quantity * productionRate)
                    totalsRaw[ingredient]['produced'][regionName] = (totalsRaw[ingredient]['produced'][regionName] || 0) - (quantity * productionRate)
                } else {
                    totalsRaw[ingredient]['produced'] = (totalsRaw[ingredient]['produced'] || 0) - (quantity * productionRate)
                }
            })
        }
        return totalsRaw
    })
})

const totals = Object.keys(totalsRaw).sort().reduce((obj, itemName) => {
    obj[itemName] = totalsRaw[itemName]
    const store = store_stock[itemName]
    const regionDemand = demandsList.map(([regionName, regionStores]) => regionStores[store] && regionStores[store][itemName] && [regionName, regionStores[store][itemName]]).filter(Boolean)

    if (regionDemand.length) {
        obj[itemName]['demand'] = obj[itemName]['demand'] || {}
        regionDemand.forEach(([regionName, quantity]) => {
            obj[itemName]['demand']['total'] = (obj[itemName]['demand']['total'] || 0) + quantity * 2
            obj[itemName]['demand'][regionName] = quantity * 2
        })
    }
    return obj
}, {})

fs.writeFileSync('./output.json', JSON.stringify(totals, null, 2))