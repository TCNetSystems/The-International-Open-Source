import { RoomMemoryKeys, RoomTypes, dynamicScoreRoomRange, maxControllerLevel, preferredCommuneRange } from "international/constants"
import { internationalManager } from "international/international"
import { advancedFindDistance, forRoomNamesAroundRangeXY, makeRoomCoord, roomNameFromRoomXY } from "international/utils"

export const roomUtils = {
    abandonRemote(roomName: string, time: number) {

        const roomMemory = Memory.rooms[roomName]

        if (roomMemory[RoomMemoryKeys.abandonRemote] >= time) return

        roomMemory[RoomMemoryKeys.abandonRemote] = time
        delete roomMemory[RoomMemoryKeys.recursedAbandonment]
    },
    findDynamicScore(roomName: string) {
        let dynamicScore = 0

        let closestEnemy = 0
        let communeScore = 0
        let allyScore = 0

        const roomCoord = makeRoomCoord(roomName)
        forRoomNamesAroundRangeXY(roomCoord.x, roomCoord.y, dynamicScoreRoomRange, (x, y) => {
            const searchRoomName = roomNameFromRoomXY(x, y)
            const searchRoomMemory = Memory.rooms[searchRoomName]
            if (!searchRoomMemory) return

            if (searchRoomMemory[RoomMemoryKeys.type] === RoomTypes.enemy) {
                const score = advancedFindDistance(roomName, searchRoomName)
                if (score <= closestEnemy) return

                closestEnemy = score
                return
            }

            if (searchRoomMemory[RoomMemoryKeys.type] === RoomTypes.commune) {
                const searchRoom = Game.rooms[searchRoomName]
                if (!searchRoom) return

                const score =
                    Math.pow(
                        Math.abs(
                            advancedFindDistance(roomName, searchRoomName) - preferredCommuneRange,
                        ),
                        1.8,
                    ) +
                    (maxControllerLevel - searchRoom.controller.level)
                if (score <= communeScore) return

                communeScore = score
                return
            }

            if (searchRoomMemory[RoomMemoryKeys.type] === RoomTypes.ally) {
                const score =
                    Math.pow(
                        Math.abs(
                            advancedFindDistance(roomName, searchRoomName) - preferredCommuneRange,
                        ),
                        1.5,
                    ) +
                    (searchRoomMemory[RoomMemoryKeys.RCL] || 0) * 0.3
                if (score <= allyScore) return

                allyScore = score
                return
            }
        })

        dynamicScore += Math.round(Math.pow(closestEnemy, -0.8) * 25)
        dynamicScore += Math.round(communeScore * 15)
        dynamicScore += allyScore

        // Prefer minerals with below average communes

        const roomMemory = Memory.rooms[roomName]
        const mineralType = roomMemory[RoomMemoryKeys.mineralType]
        const mineralScore =
            internationalManager.mineralCommunes[mineralType] -
            internationalManager.avgCommunesPerMineral
        dynamicScore += mineralScore * 40

        roomMemory[RoomMemoryKeys.dynamicScore] = dynamicScore
        roomMemory[RoomMemoryKeys.dynamicScoreUpdate] = Game.time
    }
}
