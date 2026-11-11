# frozen_string_literal: true
# Only query existing Rails model objects. Do not call ensure_terms_for_account,
# create_terms_of_service!, save!, update!, migrate or Rails seed methods.
require "json"

target_id = Integer(ENV.fetch("QA_SHARD_TARGET_ID", "100000000000001"))
default_shard = Shard.default
root = Account.default
local_id, resolved_shard = Shard.local_id_for(target_id)
root_terms = root.terms_of_service

result = {
  targetLooksGlobal: target_id >= 10**13,
  targetStoredAsLocalAccount: Account.where(id: target_id).exists?,
  targetShardResolvable: !resolved_shard.nil?,
  targetLocalIdKnown: !local_id.nil?,
  activeShardMatchesDefault: Shard.current.id == default_shard.id,
  defaultRootAccountExists: !root.nil?,
  defaultRootAccountIsRoot: root.root_account?,
  defaultRootTermsExist: !root_terms.nil?,
  shardCount: Shard.count,
  accountCount: Account.count,
  termsCount: TermsOfService.count,
  probeKind: "live Rails model read-only introspection (single shard may limit conclusions)"
}
puts "QA_SHARD_TRACE=" + JSON.generate(result)
