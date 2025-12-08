 CREATE TABLE IF NOT EXISTS emotes(                                         
     `channelProviderId` String,                                          
     `emoteName` String,                                                  
     `userId` String,                                                     
     `usedAt` DateTime('UTC') DEFAULT toStartOfHour(now('UTC')),                                       
     `provider` Enum8('Twitch' = 1, 'BTTV' = 2, 'FFZ' = 3, 'SevenTV' = 4),
     `emoteId` String                                                     
 )                                                                        
 ENGINE = MergeTree
 ORDER BY (channelProviderId, provider, emoteName, emoteId, userId, usedAt)