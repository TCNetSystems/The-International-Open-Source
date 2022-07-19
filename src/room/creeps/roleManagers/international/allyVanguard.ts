import { allyCreepRequestNeedsIndex } from 'international/constants'
import { findObjectWithID, getRange, unpackAsPos } from 'international/generalFunctions'
import { AllyVanguard } from 'room/creeps/creepClasses'

export function allyVanguardManager(room: Room, creepsOfRole: string[]) {
    // Loop through the names of the creeps of the role

    for (const creepName of creepsOfRole) {
        // Get the creep using its name

        const creep: AllyVanguard = Game.creeps[creepName]

        const request = Memory.rooms[creep.commune].allyCreepRequest

        // If the creep has no claim target, stop

        if (!request) return

        Memory.allyCreepRequests[Memory.rooms[creep.commune].allyCreepRequest].needs[allyCreepRequestNeedsIndex.allyVanguard] -=
            creep.parts.work

        creep.say(request)

        if (room.name === request || (creep.memory.remote && room.name === creep.memory.remote)) {
            creep.buildRoom()
            continue
        }

        // Otherwise if the creep is not in the claimTarget

        // Move to it

        creep.createMoveRequest({
            origin: creep.pos,
            goal: { pos: new RoomPosition(25, 25, request), range: 25 },
            avoidEnemyRanges: true,
            typeWeights: {
                enemy: Infinity,
                ally: Infinity,
                keeper: Infinity,
                commune: 1,
                neutral: 1,
                highway: 1,
            },
        })
    }
}

AllyVanguard.prototype.travelToSource = function (sourceName) {
    const { room } = this

    this.say('FHP')

    // Try to find a harvestPosition, inform false if it failed

    if (!this.findSourceHarvestPos(sourceName)) return false

    this.say('🚬')

    // Unpack the harvestPos

    const harvestPos = unpackAsPos(this.memory.packedPos)

    // If the creep is at the creep's packedHarvestPos, inform false

    if (getRange(this.pos.x, harvestPos.x, this.pos.y, harvestPos.y) === 0) return false

    // Otherwise say the intention and create a moveRequest to the creep's harvestPos, and inform the attempt

    this.say(`⏩ ${sourceName}`)

    this.createMoveRequest({
        origin: this.pos,
        goal: {
            pos: new RoomPosition(harvestPos.x, harvestPos.y, room.name),
            range: 0,
        },
        avoidEnemyRanges: true,
    })

    return true
}

AllyVanguard.prototype.findRemote = function () {
    if (this.memory.remote) return true

    const { room } = this

    const exitRoomNames = Game.map.describeExits(room.name)

    for (const exitKey in exitRoomNames) {
        const roomName = exitRoomNames[exitKey as ExitKey]

        const roomMemory = Memory.rooms[roomName]

        // If the room type is not able to be harvested from

        if (
            !roomMemory ||
            roomMemory.type === 'enemy' ||
            roomMemory.type === 'enemyRemote' ||
            roomMemory.type === 'keeper' ||
            roomMemory.type === 'ally' ||
            roomMemory.type === 'allyRemote'
        )
            continue

        this.memory.remote = roomName
        return true
    }

    // No viable remote was found

    return false
}

AllyVanguard.prototype.getEnergyFromRemote = function () {
    const { room } = this

    if (room.name !== this.memory.remote) {
        this.createMoveRequest({
            origin: this.pos,
            goal: { pos: new RoomPosition(25, 25, this.memory.remote), range: 25 },
            avoidEnemyRanges: true,
        })

        return
    }

    if (!this.findRemote()) return

    // Define the creep's sourceName

    if (!this.findOptimalSourceName()) return

    const { sourceName } = this.memory

    // Try to move to source. If creep moved then iterate

    if (this.travelToSource(sourceName)) return

    // Try to normally harvest. Iterate if creep harvested

    if (this.advancedHarvestSource(room.get(sourceName))) return
}

AllyVanguard.prototype.getEnergyFromRoom = function () {
    const { room } = this

    if (room.controller && (room.controller.owner || room.controller.reservation)) {
        if (!this.memory.reservations || !this.memory.reservations.length) this.reserveWithdrawEnergy()

        if (!this.fulfillReservation()) {
            this.say(this.message)
            return true
        }

        this.reserveWithdrawEnergy()

        if (!this.fulfillReservation()) {
            this.say(this.message)
            return true
        }

        if (this.needsResources()) return false
        return false
    }

    // Define the creep's sourceName

    if (!this.findOptimalSourceName()) return true

    const { sourceName } = this.memory

    // Try to move to source. If creep moved then iterate

    if (this.travelToSource(sourceName)) return true

    // Try to normally harvest. Iterate if creep harvested

    if (this.advancedHarvestSource(room.get(sourceName))) return true

    return true
}

AllyVanguard.prototype.buildRoom = function () {
    const { room } = this

    if (this.needsResources()) {
        if (this.memory.remote) {
            this.getEnergyFromRemote()
            return
        }

        // If there is a controller and it's owned or reserved

        if (!this.getEnergyFromRoom()) {
            this.getEnergyFromRemote()
        }

        return
    }

    const request = Memory.rooms[this.commune].allyCreepRequest

    if (room.name !== request) {
        this.createMoveRequest({
            origin: this.pos,
            goal: { pos: new RoomPosition(25, 25, request), range: 25 },
            avoidEnemyRanges: true,
        })

        return
    }

    // If there is no construction target ID

    if (!room.memory.cSiteTargetID) {
        // Try to find a construction target. If none are found, stop

        room.findAllyCSiteTargetID(this)
    }

    // Convert the construction target ID into a game object

    let constructionTarget = findObjectWithID(room.memory.cSiteTargetID)

    // If there is no construction target

    if (!constructionTarget) {
        // Try to find a construction target. If none are found, stop

        room.findAllyCSiteTargetID(this)
    }

    // Convert the construction target ID into a game object, stopping if it's undefined

    constructionTarget = findObjectWithID(room.memory.cSiteTargetID)

    this.advancedBuildCSite(constructionTarget)
}