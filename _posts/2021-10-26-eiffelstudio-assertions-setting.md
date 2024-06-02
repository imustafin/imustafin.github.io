---
layout: post
title: "EiffelStudio Assertions Setting"
date: 2021-10-26
ref: eiffel-assertions-setting
redirect_from:
  - /en/blog/eiffelstudio-assertions-setting
---
EiffelStudio allows to control which assertions will be evaluated.
We build a cheatshseet listing
which contracts are checked for each setting.

## TLDR
Here is the cheatsheet:


<div class="overflow-x-auto" markdown="1">
||require|check|loop_invariant|loop_variant|ensure|invariant|other_library pre|other_library check|subcluster require|subcluster check|other_cluster pre|other_cluster check|indirect_cluster pre|indirect_cluster check|
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
|__All__|X|X|X|X|X|X|X| |X| |X| | | |
|__Require__|X| | | | | | | | | | | | | |
|__Ensure__| | | | |X| | | | | | | | | |
|__Check__| |X| | | | | | | | | | | | |
|__Invariant__| | | | | |X| | | | | | | | |
|__Loop__| | |X|X| | | | | | | | | | |
|__Supplier Precondition__|X| | | | | |X| |X| |X| | | |

</div>

Rows represent the types of assertions enabled. _All_ has all assertions
enabled. Other examples enable only one respective assertion.

Columns represent different types of contracts added in different
groups (clusters and libraries). The exact meanings of the column prefixes
are described [in the following section](#class-diagram).

`X` in a cell means that the respective assertion is evaluated.

## Discussion

To me personally, the only surprising fact is that in the _Supplier Precondition_
example, feature preconditions (`require`) are checked not only for methods from
other groups, but also for features of the cluster itself.

Other than that, everything seems to be clear.
* __Require__ evaluates the preconditions
* __Ensure__ evaluates the postconditions
* __Check__ evaluates the `check ... end` instructions
* __Invariant__ evaluates the class invariants
* __Loop__ evaluates the loop variants and invariants
* __Supplier Precondition__ evaluates the preconditions of features used
  directly by this cluster. That is:
  * Features of libraries (*other_library pre*)
  * Features of other clusters (*other_cluster pre*)
  * Features of this cluster (*require*)
  
## Setting Assertion Levels
Assertion levels can be configured for each _target_ and
_clusters_ and _libraries_ can override the assertion levels set by their
target.

This can be done in the EiffelStudio GUI and through the `.ecf` file.

### Setting Assertions Manually in EiffelStudio
Assertion levels can be configured in EiffelStudio GUI. The process is
already documented on eiffel.org. There is a [very short How To][eo-howto].
Basically, you need to:
1. Open the Project Settings dialog (**Project > Project Settings**)
2. Set the default assertion level for a _target_
   in the **Target > Assertions** section. This section is [described separately
   on eiffel.org][eo-assertion-options].
3. Assertion levels can be overriden per cluster or library.
   1. Navigate to
      the needed group
      * **Target > Groups > Clusters > ...** for clusters
      * **Target > Groups > Libraries > ...** for libraries
   2. Set the required assertion levels
      in the **Assertions** expandable section.
4. After changing assertions settings you _must recompile_ the system
   for settings to take effect.
   
### Setting Assertions in the ECF File
Assertion levels can be configured in the `.ecf` file as well.
We will use this in the experiment
[later](#compiling-for-different-assertion-levels)
for automated testing of the
program with different assertion levels.

The `.ecf` file is an XML file inside. Each `target`, `cluster` and `library`
element can have the `option/assertions` element which can set or override
the assertion levels:

```xml
<cluster name="other_cluster" location=".\other_cluster\">
    <option>
        <assertions
          postcondition="true"
          check="true"
          invariant="true"
          loop="true"
          supplier_precondition="true"
        />
    </option>
</cluster>
```

## The Experiment
To check which contracts are checked for each assertion level we can
write a simple program which includes different types of contracts. Then
we can switch different levels and observe which contracts are in fact evaluated.

To speed up the process and because of the high number of possible settings
combinations and types of contracts,
we can write a program which runs the Eiffel program with different assertion
levels. This program is [available on GitHub][gh-code].

### Class Diagram
While one cluster and one class is enough to show the effects of
the most of the settings, we need several clusters and a library to show
the effects of the Supplier Precondition setting.

The UML diagram shows the setup of the demo program.

{% plantuml %}
skinparam linetype ortho
hide empty members
hide circle

namespace main #becee4 {
  class APPLICATION <<root>> {
  
  }
  
  class DEMO {
  
  }
  
  namespace subcluster #FFFFFF {
    class SUBCLUSTER_DEMO
  }
}

namespace "<&book> other_library" as other_library {
  class OTHER_LIBRARY_DEMO
}


namespace other_cluster {
  class OTHER_CLUSTER_DEMO
}

namespace indirect_cluster {
  class INDIRECT_CLUSTER_DEMO
}

main.APPLICATION .d.> main.DEMO
main.DEMO .d.> other_cluster.OTHER_CLUSTER_DEMO
other_cluster.OTHER_CLUSTER_DEMO .r.> indirect_cluster.INDIRECT_CLUSTER_DEMO
main.DEMO .r.> main.subcluster.SUBCLUSTER_DEMO
main.DEMO .l.> other_library.OTHER_LIBRARY_DEMO
{% endplantuml %}

Here, `APPLICATION` is the root class (depicted by the `<<root>>` stereotype).
All types of contracts are implemented
in the `DEMO` class. `APPLICATION` and `DEMO` are part of the `main` cluster
which will have the assertions checking enabled (depicted by the blue
color of the cluster). Additionally, `DEMO` uses classes from different
clusters and libraries:
* `OTHER_LIBRARY_DEMO` is a part of the `other_library` library (depicted by
  the _book_ icon)
* `SUBCLUSTER_DEMO` is a part of the `subcluster` cluster. `subcluster` is
  a child of the `main` cluster.
* `OTHER_CLUSTER_DEMO` is a part of the `other_cluster` cluster. `other_cluster`
  is a sibling of the `main` cluster.
  
`OTHER_CLUSTER_DEMO` uses the `INDIRECT_CLUSTER_DEMO` class from the
`indirect_cluster` cluster.

All subclusters except `main` have all assertions disabled (depicted
by the white color of the clusters).

All those `*_DEMO` classes have only a precondition and a check in them. This
is to check if preconditions and other contracts are checked.

### Listing the Evaluated Contracts
We want the program to print a list of contracts it has checked. One way
to do it is to fail each contract once, print its tag and then never fail
it again. Contract violations raise an exception. We can catch this exception
and set some flag to pass this contract next time, and then to retry the
program to see if any other contract fails. This solution is based
on [this StackOverflow answer by Alexander Kogtenkov][so-ak].

Each contract will have a unique tag. We will have
a `HASH_TABLE [BOOLEAN, STRING]` which will tell if the contract should be
satisfied by its tag. The main algorithm is in the `APPLICATION` class:
```eiffel
class
    APPLICATION

create
    make

feature {NONE} -- Initialization

    make
        do
            run_demo (create {HASH_TABLE [BOOLEAN, STRING]}.make (0))
        end

    run_demo (satisfy: HASH_TABLE [BOOLEAN, STRING])
        local
            demo: DEMO
        do
            create demo.make (satisfy)
        rescue
            check attached {EXCEPTIONS}.tag_name as tag then
                print (tag + "%N")
                satisfy [tag] := True
                retry
            end
        end
end
```

And each contract will have the form
```eiffel
tag_: satisfy ["tag_"]
```

When a contract is first met, `satisfy` will not have an entry
for the tag and the `[]` feature will return `False`, failing the assertion.
We will catch the exception, put a `True` for this tag and next time the
contract will not fail.

### Compiling for Different Assertion Levels
As we [discussed previously](#setting-assertion-levels), it is possible
to set the assertion levels both in the GUI and in the `.ecf` file.

Trying to set many different combinations manually can take much time and is
error-prone. Because of this, we will write a program which writes different
settings into the `.ecf`, compile, run and collect the contracts checked.

Another benefit of having a program is that this experiment becomes
reproduceable.

This program is written in Ruby and uses [Nokogiri][nokogiri] for working
with XML. The code is available in [the same repository][gh-code], together
with the demo Eiffel program.

The program reads the original `.ecf` file, explicitly disables
all assertions in the `other_library` and all clusters. Then it
enables some assertions in the `main` cluster. The resulting XML
is written as another `.ecf` file which is then compiled and the
result is executed.
```ruby
doc = File.open(ORIGINAL_ECF) { |f| Nokogiri::XML(f) }

other_library = doc.at_xpath('//xmlns:library[@name="other_library"]')
all_clusters = doc.xpath('//xmlns:cluster')
main_cluster = doc.at_xpath('//xmlns:cluster[@name="main"]')

[other_library, *all_clusters].each do |node|
  set_assertions(node, all_disabled)
end

settings = enabled_assertions.to_h { |a| [a, true] }
set_assertions(main_cluster, settings)

ecf_name = "#{PROJECT_PATH}/check_#{name.downcase.gsub(' ', '_')}.ecf"

File.write(ecf_name, doc.to_xml)

# Compile
system <<-CMD.gsub("\n", ' ')
    ec
      -project_path "#{PROJECT_PATH}"
      -config #{ecf_name}
      -clean
      -c_compile
      >&2
CMD

# Run
out = `./#{PROJECT_PATH}/EIFGENs/contract_variants/W_code/contract_variants`

# Save results
results[name] = out.strip.split("\n")
```

Then the results are printed as a nice Markdown table, ready to be embedded
into a blog-post.

Note how we use the command line program `ec` to compile the workbench
version of the executable. The [documentation on eiffel.org][eo-cli]
lists other command line options and usage examples.

{% include refs/eiffel-assertions-setting %}
