import {
    remoteRoles,
    maxRemoteRoomDistance,
    remoteTypeWeights,
    packedPosLength,
    RoomMemoryKeys,
    RoomTypes,
    defaultDataDecay,
} from 'international/constants'
import {
    advancedFindDistance,
    customLog,
    findCarryPartsRequired,
    findLowestScore,
    randomRange,
    randomTick,
} from 'international/utils'
import { unpackPosList } from 'other/codec'
import { CommuneManager } from './commune'
import { roomUtils } from 'room/roomUtils'

export class RemotesManager {
    communeManager: CommuneManager

    constructor(communeManager: CommuneManager) {
        this.communeManager = communeManager
    }

    public preTickRun() {
        const { room } = this.communeManager

        // Loop through the commune's remote names

        for (let index = room.memory[RoomMemoryKeys.remotes].length - 1; index >= 0; index -= 1) {
            // Get the name of the remote using the index

            const remoteName = room.memory[RoomMemoryKeys.remotes][index]
            const remoteMemory = Memory.rooms[remoteName]

            // Reset values to avoid error

            for (const i in remoteMemory[RoomMemoryKeys.remoteSources]) {
                remoteMemory[RoomMemoryKeys.maxSourceIncome][i] = 0
                remoteMemory[RoomMemoryKeys.remoteSourceHarvesters][i] = 0
                remoteMemory[RoomMemoryKeys.remoteHaulers][i] = 0

                remoteMemory[RoomMemoryKeys.remoteSourceCreditChange][i] = 0
                remoteMemory[RoomMemoryKeys.remoteSourceCreditReservation][i] = 0
            }
            remoteMemory[RoomMemoryKeys.remoteReserver] = 0

            // If the room isn't a remote, remove it from the remotes array

            if (
                remoteMemory[RoomMemoryKeys.type] !== RoomTypes.remote ||
                remoteMemory[RoomMemoryKeys.commune] !== room.name
            ) {
                this.communeManager.removeRemote(remoteName, index)
                continue
            }

            // The room is closed or is now a respawn or novice zone

            if (
                Game.map.getRoomStatus(remoteName).status !==
                Game.map.getRoomStatus(room.name).status
            ) {
                this.communeManager.removeRemote(remoteName, index)
                continue
            }

            if (remoteMemory[RoomMemoryKeys.abandonRemote] > 0) {
                if (!remoteMemory[RoomMemoryKeys.recursedAbandonment]) {
                    this.recurseAbandonment(remoteName)
                }

                this.manageAbandonment(remoteName)
                continue
            }

            this.managePathCacheAllowance(remoteName)

            for (const i in remoteMemory[RoomMemoryKeys.remoteSources]) {
                remoteMemory[RoomMemoryKeys.maxSourceIncome][i] =
                    SOURCE_ENERGY_NEUTRAL_CAPACITY / ENERGY_REGEN_TIME
            }
            remoteMemory[RoomMemoryKeys.remoteReserver] = 5

            // Get the remote

            const remote = Game.rooms[remoteName]

            const possibleReservation = room.energyCapacityAvailable >= 650
            const isReserved =
                remote &&
                remote.controller.reservation &&
                remote.controller.reservation.username === Memory.me

            // If the remote is reserved

            if (possibleReservation) {
                // We can potentially double our income

                for (const i in remoteMemory[RoomMemoryKeys.remoteSources]) {
                    remoteMemory[RoomMemoryKeys.maxSourceIncome][i] *= 2
                }

                // If the reservation isn't soon to run out, relative to the room's sourceEfficacy average

                if (
                    isReserved &&
                    remote.controller.reservation.ticksToEnd >=
                        Math.min(
                            remoteMemory[RoomMemoryKeys.remoteControllerPath].length *
                                packedPosLength *
                                5,
                            2500,
                        )
                )
                    remoteMemory[RoomMemoryKeys.remoteReserver] = 0
            }

            if (remote) {
                /*
                remoteMemory[RoomMemoryKeys.minDamage] = 0
                remoteMemory[RoomMemory\google-sheets\flowchartKeys.minHeal] = 0

                // Increase the defenderNeed according to the enemy attackers' combined strength

                for (const enemyCreep of remote.enemyCreeps) {
                    remoteMemory[RoomMemoryKeys.minDamage] +=
                        enemyCreep.combatStrength.heal + enemyCreep.combatStrength.heal * enemyCreep.defenceStrength ||
                        Math.max(Math.floor(enemyCreep.hits / 20), 1)
                    remoteMemory[RoomMemoryKeys.minHeal] += enemyCreep.combatStrength.ranged
                } */

                // Record if we have or don't have a source container for each source

                const sourceContainers = remote.sourceContainers
                for (const i in sourceContainers) {
                    remoteMemory[RoomMemoryKeys.hasContainer][i] = !!sourceContainers
                }

                // Temporary measure while DynamicSquads are in progress

                const enemyAttackers = remote.enemyAttackers
                if (enemyAttackers.length) {
                    const score = findLowestScore(enemyAttackers, creep => {
                        return creep.ticksToLive
                    })
                    remoteMemory[RoomMemoryKeys.danger] =
                        Game.time + randomRange(score, score + 100)
                    roomUtils.abandonRemote(remoteName, randomRange(score, score + 100))
                    continue
                }

                // If the controller is reserved and not by me

                if (
                    remote.controller.reservation &&
                    remote.controller.reservation.username !== Memory.me
                )
                    remoteMemory[RoomMemoryKeys.enemyReserved] = true
                // If the controller is not reserved or is by us
                else remoteMemory[RoomMemoryKeys.enemyReserved] = false

                remoteMemory[RoomMemoryKeys.remoteCoreAttacker] =
                    remote.roomManager.structures.invaderCore.length * 8
                remoteMemory[RoomMemoryKeys.invaderCore] =
                    remote.roomManager.structures.invaderCore.length

                // Create need if there are any structures that need to be removed

                remoteMemory[RoomMemoryKeys.remoteDismantler] = Math.min(
                    remote.dismantleTargets.length,
                    8,
                )
            }

            for (const i in remoteMemory[RoomMemoryKeys.remoteSources]) {
                const hasContainer = remoteMemory[RoomMemoryKeys.hasContainer][i]
                if (hasContainer) {
                    const creditChange = CONTAINER_DECAY / (CONTAINER_DECAY_TIME * REPAIR_POWER)
                    if (remoteMemory[RoomMemoryKeys.remoteSourceCredit][i] > 0) {
                        remoteMemory[RoomMemoryKeys.remoteSourceCredit][i] -= creditChange
                    }
                    remoteMemory[RoomMemoryKeys.remoteSourceCreditChange][i] -= creditChange
                    remoteMemory[RoomMemoryKeys.maxSourceIncome][i] -= creditChange
                    continue
                }

                // We don't have a container

                const creditChange = Math.ceil(
                    remoteMemory[RoomMemoryKeys.remoteSourceCredit][i] / ENERGY_DECAY,
                )
                if (remoteMemory[RoomMemoryKeys.remoteSourceCredit][i] > 0) {
                    remoteMemory[RoomMemoryKeys.remoteSourceCredit][i] -= creditChange
                }
                remoteMemory[RoomMemoryKeys.remoteSourceCreditChange][i] -= creditChange
                remoteMemory[RoomMemoryKeys.maxSourceIncome][i] -= creditChange
            }

            // If the remote is assumed to be reserved by an enemy or an invader core

            if (
                (remoteMemory[RoomMemoryKeys.enemyReserved] &&
                    remoteMemory[RoomMemoryKeys.invaderCore]) ||
                remoteMemory[RoomMemoryKeys.remoteDismantler]
            ) {
                for (const i in remoteMemory[RoomMemoryKeys.maxSourceIncome]) {
                    remoteMemory[RoomMemoryKeys.maxSourceIncome][i] = 0
                }
                remoteMemory[RoomMemoryKeys.remoteReserver] = 0
            }
        }
    }

    public run() {
        // Loop through the commune's remote names

        for (const remoteName of this.communeManager.room.memory[RoomMemoryKeys.remotes]) {
            const remoteMemory = Memory.rooms[remoteName]

            for (const sourceIndex in remoteMemory[RoomMemoryKeys.remoteSources]) {
                // If there was no change in credits, move the values closer to 0 by a %
                if (remoteMemory[RoomMemoryKeys.remoteSourceCreditChange][sourceIndex] <= 0) {
                    remoteMemory[RoomMemoryKeys.remoteSourceCredit][sourceIndex] *= 0.999
                }
            }

            if (remoteMemory[RoomMemoryKeys.abandonRemote]) continue

            /*
            const remote = Game.rooms[remoteName]
            const isReserved =
                remote && remote.controller.reservation && remote.controller.reservation.username === Memory.me
 */
            // Loop through each index of sourceEfficacies

            for (const sourceIndex in remoteMemory[RoomMemoryKeys.remoteSources]) {
                if (remoteMemory[RoomMemoryKeys.maxSourceIncome][sourceIndex] === 0) continue

                const income = Math.min(
                    // Make sure we ignore negative credit changes
                    Math.max(remoteMemory[RoomMemoryKeys.remoteSourceCreditChange][sourceIndex], 0),
                    remoteMemory[RoomMemoryKeys.maxSourceIncome][sourceIndex],
                )

                // Find the number of carry parts required for the source, and add it to the remoteHauler need

                remoteMemory[RoomMemoryKeys.remoteHaulers][sourceIndex] += findCarryPartsRequired(
                    remoteMemory[RoomMemoryKeys.remoteSourceFastFillerPaths][sourceIndex].length /
                        packedPosLength,
                    income,
                )
            }
        }
    }

    /**
     * Every x ticks see if sourcePath is safe to use
     */
    private managePathCacheAllowance(remoteName: string) {
        if (!randomTick(20)) return

        const remoteMemory = Memory.rooms[remoteName]

        for (let index in remoteMemory[RoomMemoryKeys.remoteSources]) {
            const pathRoomNames: Set<string> = new Set()

            for (const pos of unpackPosList(
                remoteMemory[RoomMemoryKeys.remoteSourceFastFillerPaths][index],
            )) {
                const roomName = pos.roomName

                if (pathRoomNames.has(roomName)) continue
                pathRoomNames.add(roomName)

                // See if the room has a valid type and isn't abandoned

                if (
                    remoteTypeWeights[remoteMemory[RoomMemoryKeys.type]] !== Infinity &&
                    !remoteMemory[RoomMemoryKeys.abandonRemote]
                )
                    continue

                remoteMemory[RoomMemoryKeys.disableCachedPaths] = true
                return
            }
        }

        remoteMemory[RoomMemoryKeys.disableCachedPaths] = false
    }

    private manageAbandonment(remoteName: string) {
        const remoteMemory = Memory.rooms[remoteName]

        remoteMemory[RoomMemoryKeys.abandonRemote] -= 1
    }

    private isRemoteBlocked(remoteName: string) {
        const safeDistance = advancedFindDistance(this.communeManager.room.name, remoteName, {
            typeWeights: remoteTypeWeights,
            avoidDanger: true,
        })
        if (safeDistance > maxRemoteRoomDistance) return true

        const distance = advancedFindDistance(this.communeManager.room.name, remoteName, {
            typeWeights: remoteTypeWeights,
        })
        if (Math.round(safeDistance * 0.75) > distance) return true

        return false
    }

    private recurseAbandonment(remoteName: string) {
        const remoteMemory = Memory.rooms[remoteName]

        for (const remoteName2 of remoteMemory[RoomMemoryKeys.pathsThrough]) {
            const remoteMemory2 = Memory.rooms[remoteName2]
            if (
                remoteMemory2[RoomMemoryKeys.abandonRemote] >=
                remoteMemory[RoomMemoryKeys.abandonRemote]
            )
                continue

            roomUtils.abandonRemote(remoteName2, remoteMemory[RoomMemoryKeys.abandonRemote])
            this.recurseAbandonment(remoteName2)
        }

        remoteMemory[RoomMemoryKeys.recursedAbandonment] = true
    }
}
